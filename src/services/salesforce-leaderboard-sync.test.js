const assert = require('assert');
// eslint-disable-next-line import/no-unresolved
const test = require('node:test');

const { contactFields, eventFields } = require('./salesforce-leaderboard-sync');

test('maps leaderboard state to Salesforce Contact fields', () => {
  const fields = contactFields({
    allTimePosition: 8,
    previousAllTimePosition: 14,
    monthlyPosition: 3,
    previousMonthlyPosition: 7,
    monthKey: '2026-07',
    reviewCount: 25,
    updatedAt: new Date('2026-07-23T18:00:00Z')
  });
  assert.equal(fields.Current_All_Time_Leaderboard_Position__c, 8);
  assert.equal(fields.Monthly_Leaderboard_Position__c, 3);
  assert.equal(fields.Number_of_Reviews__c, 25);
  assert.equal(fields.Monthly_Leaderboard_Month__c, undefined);
});

test('maps a milestone job to the existing Salesforce event object', () => {
  const fields = eventFields({
    userId: '507f1f77bcf86cd799439011',
    contactId: '003000000000001',
    payload: {
      leaderboardType: 'All-Time',
      eventType: 'Reached Top 10',
      oldPosition: 14,
      newPosition: 8,
      uniqueEventKey: '507f1f77bcf86cd799439011:all-time:top10'
    }
  });
  assert.equal(fields.Contact__c, '003000000000001');
  assert.equal(fields.Email_Status__c, 'Pending');
  assert.equal(
    fields.Unique_Event_Key__c,
    '507f1f77bcf86cd799439011:all-time:top10'
  );
});
