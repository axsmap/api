trigger AXSMapPledgePaymentWebhookTrigger on AXS_Map_Pledge__c (after update) {
    Set<Id> changedPledgeIds = new Set<Id>();
    for (AXS_Map_Pledge__c pledge : Trigger.new) {
        AXS_Map_Pledge__c previous = Trigger.oldMap.get(pledge.Id);
        if (pledge.Status__c != previous.Status__c &&
            AXSMapPledgePaymentWebhook.isSupportedStatus(pledge.Status__c) &&
            !String.isBlank(pledge.AXS_Map_Pledge_ID__c) &&
            pledge.Donation_Opportunity__c != null) {
            changedPledgeIds.add(pledge.Id);
        }
    }
    if (!changedPledgeIds.isEmpty()) {
        System.enqueueJob(new AXSMapPledgePaymentWebhook(changedPledgeIds));
    }
}
