const axios = require('axios');

function getBaseUrl() {
  return process.env.PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

function assertConfigured() {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    const error = new Error('PayPal is not configured');
    error.status = 503;
    throw error;
  }
}

async function getAccessToken() {
  assertConfigured();

  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');
  const response = await axios.post(
    `${getBaseUrl()}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  return response.data.access_token;
}

async function paypalRequest({ method, path, data, requestId }) {
  const accessToken = await getAccessToken();
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };
  if (requestId) headers['PayPal-Request-Id'] = requestId;

  const response = await axios({
    method,
    url: `${getBaseUrl()}${path}`,
    headers,
    data
  });
  return response.data;
}

async function createOrder({
  donation,
  event,
  participant,
  returnUrl,
  cancelUrl
}) {
  const amount = (donation.amountCents / 100).toFixed(2);
  return paypalRequest({
    method: 'post',
    path: '/v2/checkout/orders',
    requestId: `axs-donation-create-${donation.id}`,
    data: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: donation.id,
          custom_id: donation.id,
          invoice_id: `axs-${donation.id}`,
          description: `AXS Map donation supporting ${
            participant.firstName
          } for ${event.name}`.slice(0, 127),
          amount: {
            currency_code: donation.currency,
            value: amount
          }
        }
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'AXS Lab',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
            return_url: returnUrl,
            cancel_url: cancelUrl
          }
        }
      }
    }
  });
}

async function captureOrder(orderId, donationId) {
  return paypalRequest({
    method: 'post',
    path: `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    requestId: `axs-donation-capture-${donationId}`,
    data: {}
  });
}

async function verifyWebhook(headers, event) {
  if (!process.env.PAYPAL_WEBHOOK_ID) {
    const error = new Error('PayPal webhook is not configured');
    error.status = 503;
    throw error;
  }

  const result = await paypalRequest({
    method: 'post',
    path: '/v1/notifications/verify-webhook-signature',
    data: {
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: event
    }
  });

  return result.verification_status === 'SUCCESS';
}

module.exports = {
  captureOrder,
  createOrder,
  verifyWebhook
};
