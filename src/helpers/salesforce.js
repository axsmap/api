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

function authenticationParameters() {
  const params = new URLSearchParams();
  const authFlow =
    process.env.SALESFORCE_AUTH_FLOW || 'refresh_token';

  if (authFlow === 'client_credentials') {
    params.set('grant_type', 'client_credentials');
    params.set('client_id', requireConfig('SALESFORCE_CLIENT_ID'));
    params.set('client_secret', requireConfig('SALESFORCE_CLIENT_SECRET'));
    return params;
  }
  if (authFlow !== 'refresh_token') {
    const error = new Error(
      `Unsupported Salesforce authentication flow: ${authFlow}`
    );
    error.code = 'SALESFORCE_AUTH_FLOW_UNSUPPORTED';
    throw error;
  }

  params.set('grant_type', 'refresh_token');
  params.set('client_id', requireConfig('SALESFORCE_CLIENT_ID'));
  params.set('client_secret', requireConfig('SALESFORCE_CLIENT_SECRET'));
  params.set('refresh_token', requireConfig('SALESFORCE_REFRESH_TOKEN'));
  return params;
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

  const params = authenticationParameters();

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

  if (!response.data.access_token || !response.data.instance_url) {
    const error = new Error(
      'Salesforce token response is missing access_token or instance_url'
    );
    error.code = 'SALESFORCE_INVALID_TOKEN_RESPONSE';
    throw error;
  }

  cachedSession = {
    accessToken: response.data.access_token,
    instanceUrl: response.data.instance_url.replace(/\/$/, '')
  };
  return cachedSession;
}

function isInvalidSessionError(error) {
  const responseData = error.response && error.response.data;
  const errors = Array.isArray(responseData) ? responseData : [responseData];
  return (
    error.response &&
    error.response.status === 401 &&
    errors.some(item => item && item.errorCode === 'INVALID_SESSION_ID')
  );
}

async function authenticatedRequest({ method, path, data }) {
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

async function request(options) {
  try {
    return await authenticatedRequest(options);
  } catch (error) {
    const usesStaticToken =
      process.env.SALESFORCE_ACCESS_TOKEN &&
      process.env.SALESFORCE_INSTANCE_URL;
    if (usesStaticToken || !isInvalidSessionError(error)) throw error;

    resetSession();
    return authenticatedRequest(options);
  }
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

function fieldsForExternalIdUpsert(fields, externalIdField) {
  const data = { ...fields };
  delete data[externalIdField];
  return data;
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
    data: fieldsForExternalIdUpsert(fields, externalIdField)
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
  authenticate,
  authenticationParameters,
  escapeSoql,
  fieldsForExternalIdUpsert,
  findOne,
  isInvalidSessionError,
  query,
  request,
  resetSession,
  updateRecord,
  upsertRecord
};
