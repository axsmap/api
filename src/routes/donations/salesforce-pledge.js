const salesforce = require('../../helpers/salesforce');

const PLEDGE_OBJECT = 'AXS_Map_Pledge__c';

function isoDate(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function publicRecognition(pledge) {
  return pledge.anonymous ? 'Anonymous' : 'First Name + Last Initial';
}

function pledgeFieldMapping({
  pledge,
  event,
  participant,
  campaignId,
  donorContactId,
  participantContactId,
  externalIdField
}) {
  const fields = {
    Amount_Per_Location__c: pledge.pledgeAmountCents / 100,
    Approved_Locations__c: pledge.pledgeEligibleLocations,
    Calculated_Amount__c: pledge.pledgeFinalAmountCents / 100,
    Donor_email__c: pledge.donorEmail,
    Locations_Target__c: Math.ceil(
      pledge.pledgeCapCents / pledge.pledgeAmountCents
    ),
    Mapathon__c: campaignId,
    Mapathon_Participant__c: participantContactId,
    Mapathon_Participant_Name__c: [
      participant.firstName,
      participant.lastName
    ]
      .filter(Boolean)
      .join(' '),
    Maximum_cap__c: pledge.pledgeCapCents / 100,
    Notes__c:
      `AXS Map pledge ${pledge.id}; ` +
      `Mapathon ${event.id}; Participant ${participant.id}`,
    Pledge_Date__c: isoDate(pledge.createdAt),
    Pledge_Type__c: 'Per Location',
    Public_Recognition__c: publicRecognition(pledge),
    Status__c: 'Calculated'
  };
  if (donorContactId) fields.Donor__c = donorContactId;
  fields[externalIdField] = pledge.id;
  return fields;
}

async function resolveCampaign(event) {
  const externalIdField =
    process.env.SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD;
  if (!externalIdField) {
    const error = new Error(
      'SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD is not configured'
    );
    error.code = 'SALESFORCE_CAMPAIGN_EXTERNAL_ID_REQUIRED';
    throw error;
  }

  return salesforce.findOne({
    objectName: 'Campaign',
    fieldName: externalIdField,
    value: event.id
  });
}

async function resolveParticipantContact(participant) {
  if (!participant.email) {
    const error = new Error('Mapathon participant does not have an email');
    error.code = 'PARTICIPANT_EMAIL_REQUIRED';
    throw error;
  }
  return salesforce.findOne({
    objectName: 'Contact',
    fieldName:
      process.env.SALESFORCE_CONTACT_EMAIL_FIELD || 'Email',
    value: participant.email
  });
}

async function resolveDonorContact(pledge) {
  return salesforce.findOne({
    objectName: 'Contact',
    fieldName: process.env.SALESFORCE_CONTACT_EMAIL_FIELD || 'Email',
    value: pledge.donorEmail
  });
}

async function syncCalculatedPledge({ pledge, event, participant }) {
  const externalIdField =
    process.env.SALESFORCE_PLEDGE_EXTERNAL_ID_FIELD;
  if (!externalIdField) {
    const error = new Error(
      'SALESFORCE_PLEDGE_EXTERNAL_ID_FIELD is not configured'
    );
    error.code = 'SALESFORCE_EXTERNAL_ID_REQUIRED';
    throw error;
  }

  const [campaign, participantContact] = await Promise.all([
    resolveCampaign(event),
    resolveParticipantContact(participant)
  ]);

  if (!campaign) {
    const error = new Error('Salesforce Campaign was not found for Mapathon');
    error.code = 'SALESFORCE_CAMPAIGN_NOT_FOUND';
    throw error;
  }
  if (!participantContact) {
    const error = new Error(
      'Salesforce Contact was not found for Mapathon participant'
    );
    error.code = 'SALESFORCE_PARTICIPANT_NOT_FOUND';
    throw error;
  }
  const donorContact = await resolveDonorContact(pledge);

  const fields = pledgeFieldMapping({
    pledge,
    event,
    participant,
    campaignId: campaign.Id,
    donorContactId: donorContact && donorContact.Id,
    participantContactId: participantContact.Id,
    externalIdField
  });

  return salesforce.upsertRecord({
    objectName:
      process.env.SALESFORCE_PLEDGE_OBJECT || PLEDGE_OBJECT,
    externalIdField,
    externalIdValue: pledge.id,
    fields
  });
}

module.exports = {
  isoDate,
  pledgeFieldMapping,
  publicRecognition,
  resolveCampaign,
  resolveDonorContact,
  resolveParticipantContact,
  syncCalculatedPledge
};
