// services/apple.js
const axios = require("axios");

const APPLE_PROD = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_SANDBOX = "https://sandbox.itunes.apple.com/verifyReceipt";

async function verifyAppleReceipt(base64Receipt) {
  const body = {
    "receipt-data": base64Receipt,
    password: process.env.APPLE_SHARED_SECRET,
    "exclude-old-transactions": true,
  };

  // Try production then fallback to sandbox on 21007
  
  const tryVerify = async (url) =>
    (await axios.post(url, body, { timeout: 10000 })).data;

  let data = await tryVerify(APPLE_PROD);
  if (data.status === 21007) data = await tryVerify(APPLE_SANDBOX);

  if (data.status !== 0) {
    const err = new Error(`Apple verify failed: status ${data.status}`);
    err.apple = data;
    throw err;
  }
  return data;
}

// Extract latest transaction for a given product (auto-renewing sub)
function pickLatestForProduct(receipt, productId) {
  const items = (receipt.latest_receipt_info || []).filter(
    (i) => i.product_id === productId
  );
  if (!items.length) return null;

  // newest by expires date if present, else by purchase date
  const sorted = items.sort((a, b) => {
    const aExp = Number(a.expires_date_ms || 0);
    const bExp = Number(b.expires_date_ms || 0);
    return bExp - aExp;
  });

  const latest = sorted[0];
  const pending = (receipt.pending_renewal_info || []).find(
    (p) => p.product_id === productId
  );
  return {
    transactionId: latest.transaction_id,
    originalTransactionId: latest.original_transaction_id,
    purchasedAt: new Date(Number(latest.purchase_date_ms)),
    expiresAt: latest.expires_date_ms
      ? new Date(Number(latest.expires_date_ms))
      : undefined,
    willRenew: pending
      ? pending.auto_renew_status === "1"
      : Boolean(latest.expires_date_ms),
    environment: receipt.environment?.toLowerCase() || "production",
    raw: { latest, pending },
  };
}

module.exports = { verifyAppleReceipt, pickLatestForProduct };
