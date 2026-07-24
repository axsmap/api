@IsTest
private class AXSMapPledgePaymentWebhookTest {
    private class SuccessMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest request) {
            System.assertEquals('POST', request.getMethod());
            System.assertEquals(
                'callout:Access_Map_Production_API/donations/salesforce/payment-confirmation',
                request.getEndpoint()
            );
            Map<String, Object> body =
                (Map<String, Object>) JSON.deserializeUntyped(request.getBody());
            System.assertEquals(true,
                AXSMapPledgePaymentWebhook.isSupportedStatus(
                    (String) body.get('status')
                ));
            HttpResponse response = new HttpResponse();
            response.setStatusCode(200);
            response.setBody('{"received":true}');
            return response;
        }
    }

    private class FailureMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest request) {
            HttpResponse response = new HttpResponse();
            response.setStatusCode(503);
            response.setBody('temporarily unavailable');
            return response;
        }
    }

    @IsTest
    static void sendsPaidPledgeAndRelatedOpportunityDetails() {
        Account account = new Account(Name = 'AXS Map Webhook Test');
        insert account;
        Opportunity opportunity = new Opportunity(
            Name = 'AXS Map Webhook Test',
            AccountId = account.Id,
            StageName = 'Pledged',
            CloseDate = Date.today(),
            PayPal_Transaction_ID__c = 'PAYPAL-TEST',
            Receipt_sent__c = true
        );
        insert opportunity;
        AXS_Map_Pledge__c pledge = new AXS_Map_Pledge__c(
            AXS_Map_Pledge_ID__c = '64b000000000000000000001',
            Status__c = 'Paid',
            Payment_Date__c = Date.today(),
            Donation_Opportunity__c = opportunity.Id
        );
        insert pledge;

        Test.setMock(HttpCalloutMock.class, new SuccessMock());
        Test.startTest();
        System.enqueueJob(new AXSMapPledgePaymentWebhook(
            new Set<Id>{ pledge.Id }
        ));
        Test.stopTest();
    }

    @IsTest
    static void ignoresUnsupportedStatus() {
        System.assertEquals(false,
            AXSMapPledgePaymentWebhook.isSupportedStatus('Pending'));
        System.assertEquals(true,
            AXSMapPledgePaymentWebhook.isSupportedStatus('Paid'));
    }

    @IsTest
    static void triggerEnqueuesWebhookWhenPaymentStatusChanges() {
        Account account = new Account(Name = 'AXS Map Trigger Test');
        insert account;
        Opportunity opportunity = new Opportunity(
            Name = 'AXS Map Trigger Test',
            AccountId = account.Id,
            StageName = 'Pledged',
            CloseDate = Date.today()
        );
        insert opportunity;
        AXS_Map_Pledge__c pledge = new AXS_Map_Pledge__c(
            AXS_Map_Pledge_ID__c = '64b000000000000000000003',
            Status__c = 'Calculated',
            Donation_Opportunity__c = opportunity.Id
        );
        insert pledge;

        Test.setMock(HttpCalloutMock.class, new SuccessMock());
        Test.startTest();
        pledge.Status__c = 'Payment Requested';
        update pledge;
        Test.stopTest();
    }

    @IsTest
    static void retriesTransientFailureWithoutFailingTransaction() {
        Account account = new Account(Name = 'AXS Map Retry Test');
        insert account;
        Opportunity opportunity = new Opportunity(
            Name = 'AXS Map Retry Test',
            AccountId = account.Id,
            StageName = 'Pledged',
            CloseDate = Date.today()
        );
        insert opportunity;
        AXS_Map_Pledge__c pledge = new AXS_Map_Pledge__c(
            AXS_Map_Pledge_ID__c = '64b000000000000000000002',
            Status__c = 'Payment Requested',
            Donation_Opportunity__c = opportunity.Id
        );
        insert pledge;

        Test.setMock(HttpCalloutMock.class, new FailureMock());
        Test.startTest();
        System.enqueueJob(new AXSMapPledgePaymentWebhook(
            new Set<Id>{ pledge.Id }, AXSMapPledgePaymentWebhook.MAX_ATTEMPTS
        ));
        Test.stopTest();
    }
}
