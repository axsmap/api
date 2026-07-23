# Leaderboard Salesforce sync

The API records leaderboard progress in MongoDB after a successful review and
syncs it to Salesforce outside the review request.

## Safety and cost controls

- Review creation succeeds even when Salesforce is unavailable.
- Contact updates are coalesced per user before they are sent.
- Milestone records are idempotent by `Unique_Event_Key__c`.
- Failed jobs use exponential backoff and a MongoDB lease.
- The worker is event-driven. It does not poll MongoDB while the queue is idle.
- No external queue, Lambda, or paid integration service is required.

## Salesforce access

The Salesforce integration user must have read/edit access to the Contact
leaderboard fields and create/read/edit access to
`AXS_Map_Leaderboard_Event__c`, including all fields populated by the sync.

The configured integration user discovered during setup is:

`aws-sync@axslab.com.integration`

## Optional configuration

The defaults match the current Salesforce Contact metadata. Override any field
without changing code:

```text
SALESFORCE_CONTACT_ALL_TIME_POSITION_FIELD
SALESFORCE_CONTACT_PREVIOUS_ALL_TIME_POSITION_FIELD
SALESFORCE_CONTACT_MONTHLY_POSITION_FIELD
SALESFORCE_CONTACT_PREVIOUS_MONTHLY_POSITION_FIELD
SALESFORCE_CONTACT_REVIEW_COUNT_FIELD
SALESFORCE_CONTACT_LAST_UPDATE_FIELD
SALESFORCE_CONTACT_MONTH_FIELD
SALESFORCE_LEADERBOARD_EVENT_OBJECT
```

Set `SALESFORCE_LEADERBOARD_SYNC_ENABLED=false` for a deployment that should
capture jobs but not transmit them.

## MongoDB collections

- `leaderboard_states`: latest persisted state per user.
- `salesforce_leaderboard_sync`: coalesced Contact jobs and immutable milestone
  jobs.

The application creates the required queue indexes at startup.
