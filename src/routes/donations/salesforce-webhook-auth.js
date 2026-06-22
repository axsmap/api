const crypto = require('crypto');

const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000;

function canonicalPaymentConfirmation(body) {
  return [
    body.axsMapPledgeId || '',
    body.status || '',
    body.opportunityId || '',
    body.paypalTransactionId || '',
    body.paymentDate || '',
    body.receiptSent === true ? 'true' : 'false'
  ].join('|');
}

function expectedSignature({ body, timestamp, secret }) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${canonicalPaymentConfirmation(body)}`)
    .digest('hex');
}

function verifySalesforceWebhook({ body, headers, now = Date.now() }) {
  const secret = process.env.SALESFORCE_WEBHOOK_SECRET;
  if (!secret) {
    const error = new Error('SALESFORCE_WEBHOOK_SECRET is not configured');
    error.code = 'SALESFORCE_WEBHOOK_NOT_CONFIGURED';
    throw error;
  }

  const timestamp = headers['x-axsmap-timestamp'];
  const signature = headers['x-axsmap-signature'];
  const timestampMs = Number(timestamp);
  if (
    !timestamp ||
    !Number.isFinite(timestampMs) ||
    Math.abs(now - timestampMs) > MAX_TIMESTAMP_AGE_MS
  ) {
    return false;
  }
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;

  const expected = expectedSignature({ body, timestamp, secret });
  return crypto.timingSafeEqual(
    Buffer.from(signature.toLowerCase(), 'hex'),
    Buffer.from(expected, 'hex')
  );
}

module.exports = {
  canonicalPaymentConfirmation,
  expectedSignature,
  verifySalesforceWebhook
};
