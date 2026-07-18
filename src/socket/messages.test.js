const assert = require('assert');
// eslint-disable-next-line import/no-unresolved
const test = require('node:test');
const { Types } = require('mongoose');

const {
  MAX_MESSAGE_LENGTH,
  registerMessageHandlers,
  validateText
} = require('./messages');
const {
  MESSAGE_RATE_LIMIT,
  MESSAGE_RATE_WINDOW_MS,
  consumeMessageRateLimit,
  resetMessageRateLimits
} = require('./message-rate-limit');

const userId = new Types.ObjectId().toString();
const otherUserId = new Types.ObjectId().toString();
const connectionId = new Types.ObjectId().toString();

function createHarness(overrides = {}) {
  let handler;
  const emitted = [];
  const joined = [];
  const socket = {
    data: { userId },
    on(event, callback) {
      if (event === 'chat:message:send') handler = callback;
    },
    emit(event, payload) {
      emitted.push({ room: 'socket', event, payload });
    },
    async join(room) {
      joined.push(room);
    }
  };
  const io = {
    to(room) {
      return {
        emit(event, payload) {
          emitted.push({ room, event, payload });
        }
      };
    }
  };
  let savedValues;
  const now = new Date();
  const dependencies = {
    authorizeChatConnection: async () => ({
      otherUser: { _id: new Types.ObjectId(otherUserId) }
    }),
    consumeMessageRateLimit: () => true,
    createMessage: async values => {
      savedValues = values;
      return {
        _id: new Types.ObjectId(),
        ...values,
        createdAt: now,
        updatedAt: now
      };
    },
    ...overrides
  };
  registerMessageHandlers(io, socket, dependencies);
  return { emitted, joined, send: handler, savedValues: () => savedValues };
}

test('empty and oversized messages are rejected', async () => {
  assert.strictEqual(validateText('   '), 'Message cannot be empty');
  assert.strictEqual(
    validateText('x'.repeat(MAX_MESSAGE_LENGTH + 1)),
    'Message cannot exceed 2000 characters'
  );
});

test('sender identity comes from the authenticated socket, not the payload', async () => {
  const harness = createHarness();
  let result;
  await harness.send(
    { connectionId, text: ' hello ', senderId: otherUserId },
    response => {
      result = response;
    }
  );
  assert.strictEqual(result.ok, true);
  assert.strictEqual(harness.savedValues().sender.toString(), userId);
  assert.strictEqual(harness.savedValues().text, 'hello');
});

test('saved messages broadcast to the connection room and unread user room', async () => {
  const harness = createHarness();
  await harness.send({ connectionId, text: 'hello' }, () => {});
  assert.ok(
    harness.emitted.some(
      item =>
        item.room === `connection:${connectionId}` &&
        item.event === 'chat:message:new'
    )
  );
  assert.ok(
    harness.emitted.some(
      item =>
        item.room === `user:${otherUserId}` && item.event === 'chat:unread:new'
    )
  );
});

test('authorization is checked for every send', async () => {
  let checks = 0;
  const error = new Error('Only accepted connections can chat');
  error.status = 403;
  const harness = createHarness({
    authorizeChatConnection: async () => {
      checks += 1;
      throw error;
    }
  });
  let first;
  let second;
  await harness.send({ connectionId, text: 'one' }, value => {
    first = value;
  });
  await harness.send({ connectionId, text: 'two' }, value => {
    second = value;
  });
  assert.strictEqual(checks, 2);
  assert.strictEqual(first.code, 403);
  assert.strictEqual(second.code, 403);
});

test('rate limiter permits 20 messages per 10 seconds and resets', () => {
  resetMessageRateLimits();
  const start = 100000;
  for (let index = 0; index < MESSAGE_RATE_LIMIT; index += 1) {
    assert.strictEqual(consumeMessageRateLimit(userId, start + index), true);
  }
  assert.strictEqual(consumeMessageRateLimit(userId, start + 100), false);
  assert.strictEqual(
    consumeMessageRateLimit(userId, start + MESSAGE_RATE_WINDOW_MS + 1),
    true
  );
});
