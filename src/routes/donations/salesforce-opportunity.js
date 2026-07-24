const salesforce = require('../../helpers/salesforce');
const { Event } = require('../../models/event');
const { User } = require('../../models/user');

const DEFAULT_EXTERNAL_ID_FIELD = 'AXS_Map_Donation_ID__c';

function isoDate(value) {
  return new Date(value || Date.now()).toISOString().slice(0, 10);
}

function configuredField(name) {
  return process.env[name] || '';
}

function configuredExternalIdField() {
  return (
    process.env.SALESFORCE_OPPORTUNITY_EXTERNAL_ID_FIELD ||
    process.env.SALESFORCE_DONATION_EXTERNAL_ID_FIELD ||
    DEFAULT_EXTERNAL_ID_FIELD
  );
}

function opportunityName({ donation, event }) {
  const eventName = event && event.name ? event.name : 'Mapathon';
  return `AXS Map donation ${donation.id} - ${eventName}`.slice(0, 120);
}

async function resolveCampaign(event) {
  const externalIdField = process.env.SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD;
  if (!externalIdField) return null;

  if (event && event.id) {
    const eventCampaign = await salesforce.findOne({
      objectName: 'Campaign',
      fieldName: externalIdField,
      value: event.id
    });
    if (eventCampaign) return eventCampaign;
  }

  const fallbackCampaignId =
    process.env.SALESFORCE_GENERAL_DONATION_CAMPAIGN_EXTERNAL_ID;
  if (!fallbackCampaignId) return null;

  return salesforce.findOne({
    objectName: 'Campaign',
    fieldName: externalIdField,
    value: fallbackCampaignId
  });
}

async function resolveContactByEmail(email) {
  if (!email) return null;

  return salesforce.findOne({
    objectName: 'Contact',
    fieldName: process.env.SALESFORCE_CONTACT_EMAIL_FIELD || 'Email',
    value: email
  });
}

async function resolveParticipantContact(participant) {
  if (!participant || !participant.email) return null;
  return resolveContactByEmail(participant.email);
}

async function resolveDonorContact(donation) {
  return resolveContactByEmail(donation.donorEmail);
}

function contactCreationEnabled() {
  return process.env.SALESFORCE_CONTACT_CREATE_ENABLED === 'true';
}

function donorNameParts(donation) {
  const donorName = String(donation.donorName || '').trim();
  if (!donorName) {
    return { firstName: 'AXS Map', lastName: 'Donor' };
  }

  const parts = donorName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: '', lastName: parts[0] };
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
    CloseDate: isoDate(donation.confirmedAt || donation.updatedAt),
    StageName:
      process.env.SALESFORCE_OPPORTUNITY_PAID_STAGE || 'Posted - Fully Paid'
  };

  if (campaignId) fields.CampaignId = campaignId;
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

async function donationContext(donation) {
  const [event, participant] = await Promise.all([
    Event.findById(donation.event)
      .select('name')
      .lean(),
    User.findById(donation.creditedUser)
      .select('firstName lastName username email')
      .lean()
  ]);

  return { event, participant };
}

async function upsertDonationOpportunity({ donation, event, participant }) {
  if (
    !donation ||
    donation.type !== 'flat' ||
    donation.status !== 'confirmed'
  ) {
    return null;
  }

  const externalIdField = configuredExternalIdField();
  const [campaign, participantContact, donorContact] = await Promise.all([
    resolveCampaign(event),
    resolveParticipantContact(participant),
    resolveOrCreateDonorContact(donation)
  ]);

  if (process.env.SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD && !campaign) {
    const error = new Error('Salesforce Campaign was not found for Mapathon');
    error.code = 'SALESFORCE_CAMPAIGN_NOT_FOUND';
    throw error;
  }
  if (
    process.env.SALESFORCE_OPPORTUNITY_PARTICIPANT_FIELD &&
    participant &&
    !participantContact
  ) {
    const error = new Error(
      'Salesforce Contact was not found for Mapathon participant'
    );
    error.code = 'SALESFORCE_PARTICIPANT_NOT_FOUND';
    throw error;
  }

  const fields = opportunityFieldMapping({
    donation,
    event,
    campaignId: campaign && campaign.Id,
    donorContactId: donorContact && donorContact.Id,
    participantContactId: participantContact && participantContact.Id,
    externalIdField
  });

  console.log(
    `Syncing Salesforce Opportunity for donation ${donation.id} using ` +
      `${externalIdField}`
  );

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

async function syncDonationOpportunity(donation) {
  const { event, participant } = await donationContext(donation);
  return upsertDonationOpportunity({ donation, event, participant });
}

function salesforceErrorMessage(error) {
  const data = error.response && error.response.data;
  if (Array.isArray(data) && data[0]) {
    return data
      .map(item => item.message || item.errorCode)
      .filter(Boolean)
      .join('; ');
  }
  if (data && data.message) return data.message;
  return error.message || 'Salesforce sync failed';
}

async function persistSalesforceSuccess(donation, recordId) {
  const syncedAt = new Date();
  await donation.constructor.updateOne(
    { _id: donation._id },
    {
      $set: {
        salesforceOpportunityId: recordId,
        salesforceSyncedAt: syncedAt,
        salesforceSyncError: ''
      }
    }
  );
  donation.salesforceOpportunityId = recordId;
  donation.salesforceSyncedAt = syncedAt;
  donation.salesforceSyncError = '';
}

async function syncDonationOpportunitySafely(donation) {
  try {
    const record = await syncDonationOpportunity(donation);
    if (!record) return null;

    await persistSalesforceSuccess(donation, record.Id);
    return record;
  } catch (error) {
    donation.salesforceSyncError = salesforceErrorMessage(error);
    await donation.constructor
      .updateOne(
        { _id: donation._id },
        { $set: { salesforceSyncError: donation.salesforceSyncError } }
      )
      .catch(() => {});
    console.log(
      `Salesforce Opportunity failed to sync for donation ${donation.id}: ` +
        donation.salesforceSyncError
    );
    return null;
  }
}

module.exports = {
  DEFAULT_EXTERNAL_ID_FIELD,
  configuredExternalIdField,
  donationContext,
  donorContactFields,
  donorNameParts,
  opportunityFieldMapping,
  opportunityName,
  persistSalesforceSuccess,
  resolveCampaign,
  resolveContactByEmail,
  resolveDonorContact,
  resolveOrCreateDonorContact,
  resolveParticipantContact,
  salesforceErrorMessage,
  syncDonationOpportunity,
  syncDonationOpportunitySafely,
  upsertDonationOpportunity
};
