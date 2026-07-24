function calculateFinalPledgeAmount({
  pledgeAmountCents,
  pledgeCapCents,
  eligibleLocations
}) {
  const amountPerLocation = Number(pledgeAmountCents);
  const maximumAmount = Number(pledgeCapCents);
  const locations = Number(eligibleLocations);

  if (
    !Number.isInteger(amountPerLocation) ||
    amountPerLocation < 0 ||
    !Number.isInteger(maximumAmount) ||
    maximumAmount < 0 ||
    !Number.isInteger(locations) ||
    locations < 0
  ) {
    throw new TypeError('Invalid pledge settlement values');
  }

  return Math.min(amountPerLocation * locations, maximumAmount);
}

function buildSalesforcePledgePayload({ pledge, event, participant }) {
  return {
    axsMapPledgeId: pledge.id,
    axsMapMapathonId: event.id,
    axsMapParticipantId: participant.id,
    donorName: pledge.anonymous ? 'Anonymous' : pledge.donorName,
    donorEmail: pledge.donorEmail,
    anonymous: pledge.anonymous,
    mapathonName: event.name,
    mapathonEndDate: event.endDate,
    participantName: [participant.firstName, participant.lastName]
      .filter(Boolean)
      .join(' '),
    amountPerLocation: pledge.pledgeAmountCents / 100,
    maximumAmount: pledge.pledgeCapCents / 100,
    eligibleLocations: pledge.pledgeEligibleLocations,
    finalAmount: pledge.pledgeFinalAmountCents / 100,
    currency: pledge.currency,
    pledgeDate: pledge.createdAt,
    calculatedAt: pledge.pledgeCalculatedAt,
    closedAt: pledge.pledgeClosedAt,
    status: pledge.status
  };
}

module.exports = {
  buildSalesforcePledgePayload,
  calculateFinalPledgeAmount
};
