const salesforce = require('../../helpers/salesforce');

const PLEDGE_OBJECT = 'AXS_Map_Pledge__c';

function isoDate(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function splitContactName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length < 2) {
    return {
      firstName: '',
      lastName: parts[0] || 'Anonymous Donor'
    };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
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
    Donor__c: donorContactId,
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
  fields[externalIdField] = pledge.id;
  return fields;
}

async function resolveCampaign(event) {
  const externalIdField =
    process.env.SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD;
  if (externalIdField) {
    return salesforce.findOne({
      objectName: 'Campaign',
      fieldName: externalIdField,
      value: event.id
    });
  }
  return salesforce.findOne({
    objectName: 'Campaign',
    fieldName: 'Name',
    value: event.name
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
  const emailField = process.env.SALESFORCE_CONTACT_EMAIL_FIELD || 'Email';
  const existing = await salesforce.findOne({
    objectName: 'Contact',
    fieldName: emailField,
    value: pledge.donorEmail
  });
  if (existing) return existing;

  const name = splitContactName(
    pledge.anonymous ? 'Anonymous Donor' : pledge.donorName
  );
  const fields = {
    FirstName: name.firstName || undefined,
    LastName: name.lastName
  };
  fields[emailField] = pledge.donorEmail;

  const created = await salesforce.createRecord('Contact', fields);
  return { Id: created.id };
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
    donorContactId: donorContact.Id,
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
  splitContactName,
  syncCalculatedPledge
};
