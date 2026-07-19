const { spawnSync } = require('child_process');
const path = require('path');
const axios = require('axios');

const targetOrg = process.env.SALESFORCE_CLI_TARGET_ORG || 'codex-integration';
const script = process.argv[2];

function fail(message, status = 1) {
  console.error(message);
  process.exit(status);
}

function cliSession() {
  const display = spawnSync(
    'sf',
    ['org', 'display', '--target-org', targetOrg, '--verbose', '--json'],
    { encoding: 'utf8' }
  );
  if (display.status !== 0) {
    fail(
      display.stderr ||
        display.stdout ||
        'Unable to read Salesforce CLI session',
      display.status
    );
  }
  return JSON.parse(display.stdout).result || {};
}

async function refreshFromSfdxAuthUrl(sfdxAuthUrl) {
  const withoutScheme = sfdxAuthUrl.replace(/^force:\/\//, '');
  const separator = withoutScheme.lastIndexOf('@');
  if (separator < 0) {
    const error = new Error('Invalid Salesforce sfdxAuthUrl');
    error.authUrlDiagnostics = {
      length: sfdxAuthUrl.length,
      scheme: (sfdxAuthUrl.match(/^([^:]+):/) || [])[1],
      hasWhitespace: /\s/.test(sfdxAuthUrl),
      hasAtSign: sfdxAuthUrl.indexOf('@') >= 0
    };
    throw error;
  }
  const credentials = withoutScheme
    .slice(0, separator)
    .split(':')
    .map(decodeURIComponent);
  const instanceHost = withoutScheme.slice(separator + 1);
  const clientId = credentials.shift();
  const refreshToken = credentials.pop();
  const clientSecret = credentials.join(':');
  const parameters = new URLSearchParams();
  parameters.set('grant_type', 'refresh_token');
  parameters.set('client_id', clientId);
  if (clientSecret) parameters.set('client_secret', clientSecret);
  parameters.set('refresh_token', refreshToken);
  const response = await axios.post(
    `https://${instanceHost}/services/oauth2/token`,
    parameters.toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000
    }
  );
  return {
    accessToken: response.data.access_token,
    instanceUrl: response.data.instance_url
  };
}

async function main() {
  if (!script)
    fail('Usage: node run-with-salesforce-cli-auth.js <script> [arguments]', 2);
  const session = cliSession();
  if (!session.sfdxAuthUrl)
    fail('Salesforce CLI session did not provide sfdxAuthUrl');
  const refreshed = await refreshFromSfdxAuthUrl(session.sfdxAuthUrl);
  console.log(
    JSON.stringify({
      salesforceOAuthUser: session.username,
      orgId: session.id,
      targetOrg,
      authentication: 'fresh_refresh_token'
    })
  );
  const child = spawnSync(
    process.execPath,
    [path.resolve(process.cwd(), script), ...process.argv.slice(3)],
    {
      env: {
        ...process.env,
        SALESFORCE_ACCESS_TOKEN: refreshed.accessToken,
        SALESFORCE_INSTANCE_URL: refreshed.instanceUrl
      },
      stdio: 'inherit'
    }
  );
  process.exit(child.status == null ? 1 : child.status);
}

main().catch(error => {
  console.error(
    JSON.stringify(
      {
        message: error.message,
        status: error.response && error.response.status,
        details: error.response && error.response.data,
        authUrlDiagnostics: error.authUrlDiagnostics
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
