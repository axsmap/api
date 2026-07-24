const crypto = require('crypto');

function configuredSecret() {
  const secret = process.env.SALESFORCE_WEBHOOK_SECRET;
  if (!secret) {
    const error = new Error('SALESFORCE_WEBHOOK_SECRET is not configured');
    error.code = 'SALESFORCE_WEBHOOK_NOT_CONFIGURED';
    throw error;
  }
  return secret;
}

function timingSafeStringEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function verifySalesforceWebhook(headers) {
  const authorization = String(headers.authorization || '');
  if (!authorization.startsWith('Bearer ')) return false;
  return timingSafeStringEqual(
    authorization.slice('Bearer '.length),
    configuredSecret()
  );
}

module.exports = {
  configuredSecret,
  timingSafeStringEqual,
  verifySalesforceWebhook
};
