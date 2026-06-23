const salesforce = require('../../helpers/salesforce');
const {
  resolveCampaign,
  resolveDonorContact,
  resolveParticipantContact
} = require('./salesforce-pledge');

function isoDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function configuredField(name) {
  return process.env[name] || '';
}

function opportunityName({ donation, event }) {
  return `AXS Map donation ${donation.id} - ${event.name}`.slice(0, 120);
}

function contactCreationEnabled() {
  return process.env.SALESFORCE_CONTACT_CREATE_ENABLED === 'true';
}

function donorNameParts(donation) {
  const donorName = String(donation.donorName || '').trim();
  if (!donorName) {
    return {
      firstName: 'AXS Map',
      lastName: 'Donor'
    };
  }

  const parts = donorName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return {
      firstName: '',
      lastName: parts[0]
    };
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1]
  };
}

function donorContactFields(donation) {
  const emailField = process.env.SALESFORCE_CONTACT_EMAIL_FIELD || 'Email';
  const firstNameField =
    process.env.SALESFORCE_CONTACT_FIRST_NAME_FIELD || 'FirstName';
  const lastNameField =
    process.env.SALESFORCE_CONTACT_LAST_NAME_FIELD || 'LastName';
  const accountId = process.env.SALESFORCE_CONTACT_ACCOUNT_ID;
  const sourceField = process.env.SALESFORCE_CONTACT_SOURCE_FIELD;
  const sourceValue = process.env.SALESFORCE_CONTACT_SOURCE_VALUE || 'AXS Map';
  const { firstName, lastName } = donorNameParts(donation);

  const fields = {
    [emailField]: donation.donorEmail,
    [lastNameField]: lastName
  };

  if (firstName) fields[firstNameField] = firstName;
  if (accountId) fields.AccountId = accountId;
  if (sourceField) fields[sourceField] = sourceValue;

  return fields;
}

async function resolveOrCreateDonorContact(donation) {
  const existingContact = await resolveDonorContact(donation);
  if (existingContact || !contactCreationEnabled()) return existingContact;

  return salesforce.createRecord({
    objectName: 'Contact',
    fields: donorContactFields(donation)
  });
}

function opportunityFieldMapping({
  donation,
  event,
  campaignId,
  donorContactId,
  participantContactId,
  externalIdField
}) {
  const paypalTransactionField =
    process.env.SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD;
  if (!paypalTransactionField) {
    const error = new Error(
      'SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD is not configured'
    );
    error.code = 'SALESFORCE_PAYPAL_TRANSACTION_FIELD_REQUIRED';
    throw error;
  }
  const donorEmailField = process.env.SALESFORCE_OPPORTUNITY_DONOR_EMAIL_FIELD;
  if (!donorEmailField) {
    const error = new Error(
      'SALESFORCE_OPPORTUNITY_DONOR_EMAIL_FIELD is not configured'
    );
    error.code = 'SALESFORCE_DONOR_EMAIL_FIELD_REQUIRED';
    throw error;
  }

  const fields = {
    Name: opportunityName({ donation, event }),
    Amount: donation.amountCents / 100,
    CloseDate: isoDate(donation.confirmedAt || new Date()),
    StageName:
      process.env.SALESFORCE_OPPORTUNITY_PAID_STAGE || 'Posted - Fully Paid',
    CampaignId: campaignId
  };

  fields[externalIdField] = donation.id;
  fields[paypalTransactionField] =
    donation.paypalCaptureId || donation.paypalOrderId;
  fields[donorEmailField] = donation.donorEmail;

  const optionalFields = [
    ['SALESFORCE_OPPORTUNITY_PRIMARY_CONTACT_FIELD', donorContactId],
    ['SALESFORCE_OPPORTUNITY_PARTICIPANT_FIELD', participantContactId],
    [
      'SALESFORCE_OPPORTUNITY_DONATION_SOURCE_FIELD',
      process.env.SALESFORCE_OPPORTUNITY_DONATION_SOURCE_VALUE || 'AXS Map'
    ],
    [
      'SALESFORCE_OPPORTUNITY_DONATION_TYPE_FIELD',
      process.env.SALESFORCE_OPPORTUNITY_FLAT_DONATION_VALUE || 'Flat Donation'
    ],
    ['SALESFORCE_OPPORTUNITY_DONOR_NAME_FIELD', donation.donorName],
    ['SALESFORCE_OPPORTUNITY_ANONYMOUS_FIELD', donation.anonymous],
    ['SALESFORCE_OPPORTUNITY_RECEIPT_SENT_FIELD', false]
  ];

  optionalFields.forEach(([environmentName, value]) => {
    const fieldName = configuredField(environmentName);
    if (fieldName && value !== undefined && value !== null && value !== '') {
      fields[fieldName] = value;
    }
  });

  return fields;
}

async function syncConfirmedFlatDonation({ donation, event, participant }) {
  if (donation.type !== 'flat' || donation.status !== 'confirmed') {
    const error = new Error('Only confirmed flat donations can be synced');
    error.code = 'DONATION_NOT_READY_FOR_SALESFORCE';
    throw error;
  }

  const externalIdField = process.env.SALESFORCE_OPPORTUNITY_EXTERNAL_ID_FIELD;
  if (!externalIdField) {
    const error = new Error(
      'SALESFORCE_OPPORTUNITY_EXTERNAL_ID_FIELD is not configured'
    );
    error.code = 'SALESFORCE_OPPORTUNITY_EXTERNAL_ID_REQUIRED';
    throw error;
  }

  const [campaign, participantContact, donorContact] = await Promise.all([
    resolveCampaign(event),
    resolveParticipantContact(participant),
    resolveOrCreateDonorContact(donation)
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

  const fields = opportunityFieldMapping({
    donation,
    event,
    campaignId: campaign.Id,
    donorContactId: donorContact && donorContact.Id,
    participantContactId: participantContact.Id,
    externalIdField
  });

  const paypalTransactionField =
    process.env.SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD;
  const paypalTransactionId =
    donation.paypalCaptureId || donation.paypalOrderId;
  const existingOpportunity = await salesforce.findOne({
    objectName: 'Opportunity',
    fieldName: paypalTransactionField,
    value: paypalTransactionId
  });
  if (existingOpportunity) {
    return salesforce.updateRecord({
      objectName: 'Opportunity',
      recordId: existingOpportunity.Id,
      fields
    });
  }

  return salesforce.upsertRecord({
    objectName: 'Opportunity',
    externalIdField,
    externalIdValue: donation.id,
    fields
  });
}

module.exports = {
  donorContactFields,
  donorNameParts,
  isoDate,
  opportunityFieldMapping,
  opportunityName,
  resolveOrCreateDonorContact,
  syncConfirmedFlatDonation
};
