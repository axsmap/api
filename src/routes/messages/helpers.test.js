const assert = require('assert');
// eslint-disable-next-line import/no-unresolved
const test = require('node:test');
const { Types } = require('mongoose');

const { createAuthorizeChatConnection } = require('./helpers');

const requester = new Types.ObjectId();
const recipient = new Types.ObjectId();
const outsider = new Types.ObjectId();
const connectionId = new Types.ObjectId();

function createDatabase({
  connectionState = 'accepted',
  removed = false,
  blocked = false
} = {}) {
  const users = [
    {
      _id: requester,
      blockedUsers: blocked ? [recipient] : [],
      isArchived: false,
      isBlocked: false
    },
    {
      _id: recipient,
      blockedUsers: [],
      isArchived: false,
      isBlocked: false
    }
  ];

  return {
    collection(name) {
      if (name === 'connections') {
        return {
          async findOne() {
            if (removed) return null;
            return {
              _id: connectionId,
              requester,
              recipient,
              state: connectionState
            };
          }
        };
      }

      return {
        find() {
          return {
            project() {
              return {
                async toArray() {
                  return users;
                }
              };
            }
          };
        }
      };
    }
  };
}

async function expectStatus(options, userId, status) {
  const authorize = createAuthorizeChatConnection(async () =>
    createDatabase(options)
  );
  await assert.rejects(
    authorize(connectionId.toString(), userId.toString()),
    error => error.status === status
  );
}

test('accepted connection members can authorize chat', async () => {
  const authorize = createAuthorizeChatConnection(async () => createDatabase());
  const result = await authorize(connectionId.toString(), requester.toString());
  assert.strictEqual(result.otherUser._id.toString(), recipient.toString());
});

test('unconnected user receives 403', async () => {
  await expectStatus({}, outsider, 403);
});

test('pending connection receives 403', async () => {
  await expectStatus({ connectionState: 'pending' }, requester, 403);
});

test('removed connection cannot authorize', async () => {
  await expectStatus({ removed: true }, requester, 404);
});

test('blocked connection member receives 403', async () => {
  await expectStatus({ blocked: true }, requester, 403);
});
