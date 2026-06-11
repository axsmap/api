const assert = require('assert');
// eslint-disable-next-line import/no-unresolved
const test = require('node:test');

const jwt = require('jsonwebtoken');
const { User } = require('../models/user');
const { isAuthenticated } = require('./index');

const originalFindOne = User.findOne;
const originalVerify = jwt.verify;

test.afterEach(() => {
  User.findOne = originalFindOne;
  jwt.verify = originalVerify;
});

test('authenticated requests receive a saveable Mongoose user document', async () => {
  const user = {
    id: '507f1f77bcf86cd799439011',
    isAdmin: true,
    isBlocked: false,
    save() {}
  };
  let selectedFields;

  jwt.verify = async () => ({ userId: user.id });
  User.findOne = query => {
    assert.deepStrictEqual(query, {
      _id: user.id,
      isArchived: false
    });

    return {
      select(fields) {
        selectedFields = fields;
        return Promise.resolve(user);
      }
    };
  };

  const req = {
    headers: { authorization: 'Bearer valid-token' }
  };
  const res = {
    status() {
      throw new Error('Unexpected error response');
    }
  };
  let nextCalled = false;

  await isAuthenticated({ isOptional: false })(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true);
  assert.strictEqual(req.user, user);
  assert.strictEqual(typeof req.user.save, 'function');
  assert.strictEqual(req.user.isAdmin, true);
  assert.match(selectedFields, /-hashedPassword/);
  assert.doesNotMatch(selectedFields, /-isAdmin/);
  assert.doesNotMatch(selectedFields, /-isBlocked/);
});

test('blocked users are rejected before reaching the route', async () => {
  const user = {
    id: '507f1f77bcf86cd799439011',
    isBlocked: true,
    save() {}
  };

  jwt.verify = async () => ({ userId: user.id });
  User.findOne = () => ({
    select: () => Promise.resolve(user)
  });

  const req = {
    headers: { authorization: 'Bearer valid-token' }
  };
  let response;
  const res = {
    status(status) {
      response = { status };
      return {
        json(body) {
          response.body = body;
          return response;
        }
      };
    }
  };

  await isAuthenticated({ isOptional: false })(req, res, () => {
    throw new Error('Blocked request reached the route');
  });

  assert.deepStrictEqual(response, {
    status: 423,
    body: { general: 'You are blocked' }
  });
});
