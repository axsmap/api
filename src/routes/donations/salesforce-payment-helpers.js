const SUPPORTED_STATUSES = {
  'Payment Requested': 'payment_requested',
  Paid: 'paid',
  Cancelled: 'cancelled',
  Expired: 'expired'
};

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function applySalesforcePaymentUpdate({
  pledge,
  status,
  opportunityId,
  paypalTransactionId,
  paymentDate,
  receiptSent,
  now = new Date()
}) {
  const mongoStatus = SUPPORTED_STATUSES[status];
  if (!mongoStatus) {
    const error = new Error('Unsupported pledge status');
    error.code = 'UNSUPPORTED_PLEDGE_STATUS';
    throw error;
  }
  if (pledge.status === 'paid' && mongoStatus !== 'paid') {
    const error = new Error('Paid pledges cannot be moved backward');
    error.code = 'PLEDGE_ALREADY_PAID';
    throw error;
  }
  const parsedPaymentDate = paymentDate ? validDate(paymentDate) : null;
  if (paymentDate && !parsedPaymentDate) {
    const error = new Error('Invalid payment date');
    error.code = 'INVALID_PAYMENT_DATE';
    throw error;
  }

  pledge.status = mongoStatus;
  pledge.salesforcePaymentId = opportunityId || pledge.salesforcePaymentId;
  pledge.salesforcePaymentStatus = status;
  if (paypalTransactionId) pledge.paypalCaptureId = paypalTransactionId;
  if (receiptSent && !pledge.receiptSentAt) pledge.receiptSentAt = now;
  if (mongoStatus === 'paid') {
    pledge.amountCents = pledge.pledgeFinalAmountCents;
    pledge.confirmedAt = parsedPaymentDate || pledge.confirmedAt || now;
  }
  return pledge;
}

module.exports = {
  SUPPORTED_STATUSES,
  applySalesforcePaymentUpdate,
  validDate
};
