const assert = require('assert');
// eslint-disable-next-line import/no-unresolved
const test = require('node:test');

const axios = require('axios');
const salesforce = require('./salesforce');

const SALESFORCE_ENVIRONMENT = [
  'SALESFORCE_ACCESS_TOKEN',
  'SALESFORCE_AUTH_FLOW',
  'SALESFORCE_CLIENT_ID',
  'SALESFORCE_CLIENT_SECRET',
  'SALESFORCE_INSTANCE_URL',
  'SALESFORCE_LOGIN_URL',
  'SALESFORCE_REFRESH_TOKEN'
];

function withEnvironment(values, callback) {
  const previous = {};
  SALESFORCE_ENVIRONMENT.forEach(name => {
    previous[name] = process.env[name];
    delete process.env[name];
  });
  Object.entries(values).forEach(([name, value]) => {
    process.env[name] = value;
  });

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      SALESFORCE_ENVIRONMENT.forEach(name => {
        if (previous[name] === undefined) delete process.env[name];
        else process.env[name] = previous[name];
      });
      salesforce.resetSession();
    });
}

test(
  'builds Salesforce client credentials parameters',
  { concurrency: false },
  async () => {
    await withEnvironment(
      {
        SALESFORCE_AUTH_FLOW: 'client_credentials',
        SALESFORCE_CLIENT_ID: 'client-id',
        SALESFORCE_CLIENT_SECRET: 'client-secret'
      },
      () => {
        const params = salesforce.authenticationParameters();
        assert.equal(params.get('grant_type'), 'client_credentials');
        assert.equal(params.get('client_id'), 'client-id');
        assert.equal(params.get('client_secret'), 'client-secret');
        assert.equal(params.has('refresh_token'), false);
      }
    );
  }
);

test(
  'keeps refresh token authentication as the default',
  { concurrency: false },
  async () => {
    await withEnvironment(
      {
        SALESFORCE_CLIENT_ID: 'client-id',
        SALESFORCE_CLIENT_SECRET: 'client-secret',
        SALESFORCE_REFRESH_TOKEN: 'refresh-token'
      },
      () => {
        const params = salesforce.authenticationParameters();
        assert.equal(params.get('grant_type'), 'refresh_token');
        assert.equal(params.get('refresh_token'), 'refresh-token');
      }
    );
  }
);

test(
  'requires a client ID for client credentials',
  { concurrency: false },
  async () => {
    await withEnvironment(
      {
        SALESFORCE_AUTH_FLOW: 'client_credentials',
        SALESFORCE_CLIENT_SECRET: 'client-secret'
      },
      () => {
        assert.throws(
          () => salesforce.authenticationParameters(),
          error =>
            error.code === 'SALESFORCE_NOT_CONFIGURED' &&
            error.message === 'SALESFORCE_CLIENT_ID is not configured'
        );
      }
    );
  }
);

test(
  'requires a client secret for client credentials',
  { concurrency: false },
  async () => {
    await withEnvironment(
      {
        SALESFORCE_AUTH_FLOW: 'client_credentials',
        SALESFORCE_CLIENT_ID: 'client-id'
      },
      () => {
        assert.throws(
          () => salesforce.authenticationParameters(),
          error =>
            error.code === 'SALESFORCE_NOT_CONFIGURED' &&
            error.message === 'SALESFORCE_CLIENT_SECRET is not configured'
        );
      }
    );
  }
);

test(
  'authenticates using a Salesforce client credentials token response',
  { concurrency: false },
  async () => {
    const originalPost = axios.post;
    let request;
    axios.post = async (url, body, options) => {
      request = { url, body, options };
      return {
        data: {
          access_token: 'access-token',
          instance_url: 'https://axs-lab.my.salesforce.com'
        }
      };
    };

    try {
      await withEnvironment(
        {
          SALESFORCE_AUTH_FLOW: 'client_credentials',
          SALESFORCE_CLIENT_ID: 'client-id',
          SALESFORCE_CLIENT_SECRET: 'client-secret',
          SALESFORCE_LOGIN_URL: 'https://login.salesforce.com/'
        },
        async () => {
          const session = await salesforce.authenticate();
          const params = new URLSearchParams(request.body);

          assert.equal(
            request.url,
            'https://login.salesforce.com/services/oauth2/token'
          );
          assert.equal(params.get('grant_type'), 'client_credentials');
          assert.equal(params.get('client_id'), 'client-id');
          assert.equal(params.get('client_secret'), 'client-secret');
          assert.deepEqual(session, {
            accessToken: 'access-token',
            instanceUrl: 'https://axs-lab.my.salesforce.com'
          });
        }
      );
    } finally {
      axios.post = originalPost;
    }
  }
);

test('omits the external ID field from Salesforce upsert data', () => {
  const fields = {
    Name: 'AXS Map donation',
    AXS_Map_Donation_ID__c: '6a397482c5d67caef20b3b8b',
    Amount: 5
  };

  assert.deepEqual(
    salesforce.fieldsForExternalIdUpsert(fields, 'AXS_Map_Donation_ID__c'),
    {
      Name: 'AXS Map donation',
      Amount: 5
    }
  );
  assert.equal(fields.AXS_Map_Donation_ID__c, '6a397482c5d67caef20b3b8b');
});

test('recognizes only Salesforce invalid-session responses', () => {
  assert.equal(
    salesforce.isInvalidSessionError({
      response: {
        status: 401,
        data: [
          {
            message: 'Session expired or invalid',
            errorCode: 'INVALID_SESSION_ID'
          }
        ]
      }
    }),
    true
  );
  assert.equal(
    salesforce.isInvalidSessionError({
      response: {
        status: 400,
        data: [{ errorCode: 'INVALID_FIELD' }]
      }
    }),
    false
  );
});

test(
  'refreshes an expired Salesforce session and retries once',
  { concurrency: false },
  async () => {
    const originalPost = axios.post;
    const originalAdapter = axios.defaults.adapter;
    let tokenRequests = 0;
    let apiRequests = 0;

    axios.post = async () => {
      tokenRequests += 1;
      return {
        data: {
          access_token: `access-token-${tokenRequests}`,
          instance_url: 'https://axslab.my.salesforce.com'
        }
      };
    };
    axios.defaults.adapter = async config => {
      apiRequests += 1;
      if (apiRequests === 1) {
        const error = new Error('Request failed with status code 401');
        error.response = {
          status: 401,
          data: [
            {
              message: 'Session expired or invalid',
              errorCode: 'INVALID_SESSION_ID'
            }
          ]
        };
        throw error;
      }
      return {
        data: { records: [{ Id: '701campaign' }] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      };
    };

    try {
      await withEnvironment(
        {
          SALESFORCE_AUTH_FLOW: 'client_credentials',
          SALESFORCE_CLIENT_ID: 'client-id',
          SALESFORCE_CLIENT_SECRET: 'client-secret',
          SALESFORCE_LOGIN_URL: 'https://axslab.my.salesforce.com'
        },
        async () => {
          const records = await salesforce.query(
            "SELECT Id FROM Campaign WHERE Name = 'Mapathon'"
          );
          assert.deepEqual(records, [{ Id: '701campaign' }]);
          assert.equal(tokenRequests, 2);
          assert.equal(apiRequests, 2);
        }
      );
    } finally {
      axios.post = originalPost;
      axios.defaults.adapter = originalAdapter;
    }
  }
);
