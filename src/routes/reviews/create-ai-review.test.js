const assert = require('assert');
const axios = require('axios');

const createAiReview = require('./create-ai-review');

const originalPost = axios.post;
const originalApiKey = process.env.OPENAI_API_KEY;

const makeResponse = () => {
  const result = {
    statusCode: null,
    body: null
  };

  return {
    result,
    response: {
      status(statusCode) {
        result.statusCode = statusCode;
        return this;
      },
      json(body) {
        result.body = body;
        return this;
      }
    }
  };
};

async function run() {
  assert.strictEqual(
    createAiReview.buildAnswers({
      steps: false,
      hasWideEntrance: true,
      hasWashroom: null,
      ignored: true
    }),
    'steps: false\nhasWideEntrance: true'
  );

  assert.strictEqual(
    createAiReview.extractComment({
      data: {
        choices: [{ message: { content: '  Accessible entrance.  ' } }]
      }
    }),
    'Accessible entrance.'
  );

  process.env.OPENAI_API_KEY = 'test-key';
  axios.post = async (_url, payload, options) => {
    assert.strictEqual(payload.model, 'gpt-4o-mini');
    assert.ok(payload.messages[1].content.includes('steps: false'));
    assert.strictEqual(options.headers.Authorization, 'Bearer test-key');
    return {
      data: {
        choices: [
          {
            message: {
              content:
                'The entrance is step-free and wide enough for comfortable access.'
            }
          }
        ]
      }
    };
  };

  const success = makeResponse();
  await createAiReview(
    {
      body: {
        steps: false,
        hasWideEntrance: true
      },
      user: { id: 'user-1' }
    },
    success.response
  );

  assert.strictEqual(success.result.statusCode, 200);
  assert.strictEqual(
    success.result.body.data,
    'The entrance is step-free and wide enough for comfortable access.'
  );

  const invalid = makeResponse();
  await createAiReview(
    {
      body: {
        steps: null,
        hasWideEntrance: undefined
      },
      user: { id: 'user-1' }
    },
    invalid.response
  );

  assert.strictEqual(invalid.result.statusCode, 400);
  assert.strictEqual(
    invalid.result.body.general,
    'Accessibility answers are required'
  );
}

run()
  .then(() => {
    console.log('create-ai-review tests passed');
  })
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .then(() => {
    axios.post = originalPost;
    if (typeof originalApiKey === 'undefined') {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  });
