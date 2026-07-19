const axios = require('axios');

require('dotenv').config();

const salesforce = require('../helpers/salesforce');

async function main() {
  const loginUrl = (
    process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com'
  ).replace(/\/$/, '');
  const tokenResponse = await axios.post(
    `${loginUrl}/services/oauth2/token`,
    salesforce.authenticationParameters().toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000
    }
  );
  const token = tokenResponse.data;
  if (!token.id)
    throw new Error('Salesforce token response has no identity URL');
  const identityParts = new URL(token.id).pathname.split('/').filter(Boolean);
  const userId = identityParts[identityParts.length - 1];
  const organizationId = identityParts[identityParts.length - 2];
  const users = await salesforce.queryAll(
    'SELECT Id, Username, Name FROM User ' +
      `WHERE Id = '${salesforce.escapeSoql(userId)}' LIMIT 1`
  );
  const user = users[0];
  if (!user) throw new Error(`Salesforce OAuth user ${userId} was not found`);

  let permissionFields = [];
  let assignments = [];
  let permissionInspectionError;
  try {
    const permissionDescription = await salesforce.request({
      method: 'get',
      path: '/sobjects/PermissionSet/describe'
    });
    permissionFields = permissionDescription.fields
      .map(field => field.name)
      .filter(name => /Modify(AllData|Metadata)/i.test(name));
    const select = [
      'PermissionSet.Name',
      'PermissionSet.Label',
      ...permissionFields.map(name => `PermissionSet.${name}`)
    ];
    assignments = await salesforce.queryAll(
      `SELECT ${select.join(', ')} FROM PermissionSetAssignment ` +
        `WHERE AssigneeId = '${salesforce.escapeSoql(userId)}'`
    );
  } catch (error) {
    permissionInspectionError = {
      status: error.response && error.response.status,
      details: error.response && error.response.data
    };
  }

  console.log(
    JSON.stringify(
      {
        authenticationFlow: process.env.SALESFORCE_AUTH_FLOW || 'refresh_token',
        staticAccessTokenConfigured: Boolean(
          process.env.SALESFORCE_ACCESS_TOKEN
        ),
        identity: {
          userId,
          username: user.Username,
          displayName: user.Name,
          organizationId
        },
        permissionFields,
        permissionInspectionError,
        assignedPermissionSets: assignments.map(assignment => ({
          name: assignment.PermissionSet && assignment.PermissionSet.Name,
          label: assignment.PermissionSet && assignment.PermissionSet.Label,
          permissions: Object.fromEntries(
            permissionFields.map(name => [
              name,
              Boolean(
                assignment.PermissionSet && assignment.PermissionSet[name]
              )
            ])
          )
        }))
      },
      null,
      2
    )
  );
}

main().catch(error => {
  console.error(
    JSON.stringify(
      {
        message: error.message,
        status: error.response && error.response.status,
        details: error.response && error.response.data
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
