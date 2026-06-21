const axios = require('axios');

let cachedSession;

function configuredApiVersion() {
  const version = process.env.SALESFORCE_API_VERSION || 'v64.0';
  return version.startsWith('v') ? version : `v${version}`;
}

function configuredLoginUrl() {
  return (process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com')
    .replace(/\/$/, '');
}

function requireConfig(name) {
  const value = process.env[name];
  if (!value) {
    const error = new Error(`${name} is not configured`);
    error.code = 'SALESFORCE_NOT_CONFIGURED';
    throw error;
  }
  return value;
}

async function authenticate() {
  const configuredAccessToken = process.env.SALESFORCE_ACCESS_TOKEN;
  const configuredInstanceUrl = process.env.SALESFORCE_INSTANCE_URL;
  if (configuredAccessToken && configuredInstanceUrl) {
    return {
      accessToken: configuredAccessToken,
      instanceUrl: configuredInstanceUrl.replace(/\/$/, '')
    };
  }

  if (cachedSession) return cachedSession;

  const params = new URLSearchParams();
  params.set('grant_type', 'refresh_token');
  params.set('client_id', requireConfig('SALESFORCE_CLIENT_ID'));
  params.set('client_secret', requireConfig('SALESFORCE_CLIENT_SECRET'));
  params.set('refresh_token', requireConfig('SALESFORCE_REFRESH_TOKEN'));

  const response = await axios.post(
    `${configuredLoginUrl()}/services/oauth2/token`,
    params.toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    }
  );

  cachedSession = {
    accessToken: response.data.access_token,
    instanceUrl: response.data.instance_url.replace(/\/$/, '')
  };
  return cachedSession;
}

async function request({ method, path, data }) {
  const session = await authenticate();
  const response = await axios({
    method,
    url: `${session.instanceUrl}/services/data/${configuredApiVersion()}${path}`,
    data,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });
  return response.data;
}

function escapeSoql(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

async function query(soql) {
  const result = await request({
    method: 'get',
    path: `/query?q=${encodeURIComponent(soql)}`
  });
  return result.records || [];
}

async function findOne({ objectName, fieldName, value }) {
  const records = await query(
    `SELECT Id FROM ${objectName} WHERE ${fieldName} = ` +
      `'${escapeSoql(value)}' LIMIT 2`
  );
  if (records.length > 1) {
    const error = new Error(
      `Multiple ${objectName} records match ${fieldName}`
    );
    error.code = 'SALESFORCE_AMBIGUOUS_MATCH';
    throw error;
  }
  return records[0] || null;
}

async function upsertRecord({
  objectName,
  externalIdField,
  externalIdValue,
  fields
}) {
  await request({
    method: 'patch',
    path:
      `/sobjects/${objectName}/${externalIdField}/` +
      encodeURIComponent(externalIdValue),
    data: fields
  });

  const record = await findOne({
    objectName,
    fieldName: externalIdField,
    value: externalIdValue
  });
  if (!record) {
    throw new Error('Salesforce upsert completed but record could not be found');
  }
  return record;
}

async function updateRecord({ objectName, recordId, fields }) {
  await request({
    method: 'patch',
    path: `/sobjects/${objectName}/${encodeURIComponent(recordId)}`,
    data: fields
  });
  return { Id: recordId };
}

function resetSession() {
  cachedSession = undefined;
}

module.exports = {
  escapeSoql,
  findOne,
  query,
  request,
  resetSession,
  updateRecord,
  upsertRecord
};
