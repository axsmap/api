const assert = require('assert');
// eslint-disable-next-line import/no-unresolved
const test = require('node:test');

const { User } = require('../../models/user');
const getUser = require('./get-user');
const getUserByUsername = require('./get-user-by-username');

const originalAggregate = User.aggregate;

test.afterEach(() => {
  User.aggregate = originalAggregate;
});

const createResponse = () => {
  const response = {};

  return {
    response,
    res: {
      status(status) {
        response.status = status;
        return {
          json(body) {
            response.body = body;
            return response;
          }
        };
      }
    }
  };
};

test('user lookup by username returns the shared public profile response', async () => {
  let pipeline;
  let collation;

  User.aggregate = aggregatePipeline => {
    pipeline = aggregatePipeline;

    return {
      collation(value) {
        collation = value;
        return this;
      },
      then(resolve, reject) {
        return Promise.resolve([
          {
            id: '4fb091c465f05c010000001f',
            username: 'jason-dasilva-6iy8v',
            isArchived: false,
            isBlocked: false,
            ranking: [{ ranking: 6 }],
            reviewsAmount: 508
          }
        ]).then(resolve, reject);
      }
    };
  };

  const { response, res } = createResponse();

  await getUserByUsername(
    { params: { username: 'Jason-DaSilva-6iy8v' } },
    res,
    err => {
      throw err;
    }
  );

  assert.deepStrictEqual(pipeline[0], {
    $match: { username: 'Jason-DaSilva-6iy8v' }
  });
  assert.deepStrictEqual(collation, { locale: 'en', strength: 2 });
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.body.username, 'jason-dasilva-6iy8v');
  assert.strictEqual(response.body.ranking, 7);
  assert.strictEqual(response.body.isArchived, undefined);
  assert.strictEqual(response.body.isBlocked, undefined);
});

test('bad user id lookup returns 404 instead of throwing', async () => {
  const { response, res } = createResponse();

  await getUser({ params: { userId: 'not-a-mongo-id' } }, res, err => {
    throw err;
  });

  assert.deepStrictEqual(response, {
    status: 404,
    body: { general: 'User not found' }
  });
});
