// services/google.js
const { google } = require('googleapis');

async function androidPublisher() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  });
  const client = await auth.getClient();
  return google.androidpublisher({ version: 'v3', auth: client });
}

async function verifyAndroidProduct(productId, purchaseToken) {
  const api = await androidPublisher();
  const res = await api.purchases.products.get({
    packageName: process.env.GOOGLE_PACKAGE_NAME,
    productId,
    token: purchaseToken,
  });
  return res.data; // purchaseState, consumptionState, orderId...
}

async function verifyAndroidSubscription(productId, purchaseToken) {
  const api = await androidPublisher();
  const res = await api.purchases.subscriptions.get({
    packageName: process.env.GOOGLE_PACKAGE_NAME,
    subscriptionId: productId,
    token: purchaseToken,
  });
  return res.data; // expiryTimeMillis, autoRenewing, paymentState, cancelReason...
}

function mapAndroidStatus(d) {
  // subscriptions
  const expiresAt = d.expiryTimeMillis ? new Date(Number(d.expiryTimeMillis)) : undefined;
  const willRenew = Boolean(d.autoRenewing);
  // purchaseState: 0 purchased, 1 canceled, 2 pending (for INAPP)
  return { expiresAt, willRenew };
}

module.exports = { verifyAndroidProduct, verifyAndroidSubscription, mapAndroidStatus };
