function publicDonation(donation) {
  return {
    id: donation.id,
    event: donation.event,
    creditedUser: donation.creditedUser,
    amount: donation.amountCents / 100,
    type: donation.type,
    pledgeAmount: donation.pledgeAmountCents
      ? donation.pledgeAmountCents / 100
      : null,
    pledgeCap: donation.pledgeCapCents ? donation.pledgeCapCents / 100 : null,
    currency: donation.currency,
    status: donation.status,
    anonymous: donation.anonymous,
    donorName: donation.anonymous ? 'Anonymous' : donation.donorName,
    showAmountPublicly: donation.showAmountPublicly,
    showPledgePublicly: donation.showPledgePublicly,
    confirmedAt: donation.confirmedAt,
    createdAt: donation.createdAt
  };
}

function captureFromOrder(order) {
  const purchaseUnit = order.purchase_units && order.purchase_units[0];
  const captures =
    purchaseUnit && purchaseUnit.payments && purchaseUnit.payments.captures;
  return captures && captures[0];
}

function payerEmail(order) {
  return order.payer && order.payer.email_address
    ? order.payer.email_address
    : '';
}

module.exports = {
  captureFromOrder,
  payerEmail,
  publicDonation
};
