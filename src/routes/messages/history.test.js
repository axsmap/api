const assert = require('assert');
// eslint-disable-next-line import/no-unresolved
const test = require('node:test');
const { Types } = require('mongoose');

const { createListMessagesHandler } = require('./list-messages');
const { createMarkMessagesReadHandler } = require('./mark-messages-read');

const connectionId = new Types.ObjectId().toString();
const userId = new Types.ObjectId().toString();
const senderId = new Types.ObjectId();

function responseRecorder() {
  const output = {};
  return {
    output,
    res: {
      status(status) {
        output.status = status;
        return {
          json(body) {
            output.body = body;
            return output;
          }
        };
      }
    }
  };
}

test('history is returned oldest-first with a non-duplicating cursor', async () => {
  const dates = [4, 3, 2, 1].map(day => new Date(`2026-01-0${day}T00:00:00Z`));
  const documents = dates.map((createdAt, index) => ({
    _id: new Types.ObjectId(),
    connection: new Types.ObjectId(connectionId),
    sender: senderId,
    text: `message-${index}`,
    readBy: [],
    createdAt,
    updatedAt: createdAt
  }));
  let query;
  const getDb = async () => ({
    collection() {
      return {
        find(value) {
          query = value;
          return {
            sort() {
              return this;
            },
            limit() {
              return this;
            },
            async toArray() {
              return documents;
            }
          };
        }
      };
    }
  });
  const handler = createListMessagesHandler({
    getDb,
    authorizeChatConnection: async () => ({})
  });
  const { output, res } = responseRecorder();
  await handler(
    { params: { connectionId }, query: { limit: '3' }, user: { id: userId } },
    res,
    error => {
      throw error;
    }
  );
  assert.strictEqual(output.status, 200);
  assert.deepStrictEqual(
    output.body.results.map(message => message.createdAt),
    dates.slice(0, 3).reverse()
  );
  assert.strictEqual(output.body.hasMore, true);
  assert.strictEqual(output.body.nextCursor, dates[2].toISOString());

  const second = responseRecorder();
  await handler(
    {
      params: { connectionId },
      query: { before: output.body.nextCursor, limit: '3' },
      user: { id: userId }
    },
    second.res,
    error => {
      throw error;
    }
  );
  assert.deepStrictEqual(query.createdAt, { $lt: dates[2] });
});

test('read tracking only updates unread messages from the other user', async () => {
  let updateQuery;
  let updateOperation;
  const getDb = async () => ({
    collection() {
      return {
        async updateMany(query, operation) {
          updateQuery = query;
          updateOperation = operation;
          return { modifiedCount: 2 };
        }
      };
    }
  });
  const handler = createMarkMessagesReadHandler({
    getDb,
    authorizeChatConnection: async () => ({})
  });
  const { output, res } = responseRecorder();
  await handler(
    { params: { connectionId }, user: { id: userId } },
    res,
    error => {
      throw error;
    }
  );
  assert.strictEqual(output.status, 200);
  assert.strictEqual(output.body.updated, 2);
  assert.ok(updateQuery.sender.$ne.equals(userId));
  assert.ok(updateQuery.readBy.$ne.equals(userId));
  assert.ok(updateOperation.$addToSet.readBy.equals(userId));
});
