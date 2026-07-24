public without sharing class AXSMapPledgePaymentWebhook implements Queueable, Database.AllowsCallouts {
    @TestVisible private static final Integer MAX_ATTEMPTS = 3;
    private final Set<Id> pledgeIds;
    private final Integer attempt;

    public AXSMapPledgePaymentWebhook(Set<Id> pledgeIds) {
        this(pledgeIds, 1);
    }

    @TestVisible
    private AXSMapPledgePaymentWebhook(Set<Id> pledgeIds, Integer attempt) {
        this.pledgeIds = pledgeIds == null ? new Set<Id>() : pledgeIds;
        this.attempt = attempt;
    }

    public void execute(QueueableContext context) {
        if (pledgeIds.isEmpty()) return;

        List<AXS_Map_Pledge__c> pledges = [
            SELECT AXS_Map_Pledge_ID__c, Status__c, Payment_Date__c,
                   Donation_Opportunity__c,
                   Donation_Opportunity__r.PayPal_Transaction_ID__c,
                   Donation_Opportunity__r.Receipt_sent__c
            FROM AXS_Map_Pledge__c
            WHERE Id IN :pledgeIds
        ];

        List<Id> retryIds = new List<Id>();
        for (AXS_Map_Pledge__c pledge : pledges) {
            try {
                send(pledge);
            } catch (Exception error) {
                retryIds.add(pledge.Id);
                System.debug(LoggingLevel.ERROR,
                    'AXS Map payment webhook failed for pledge ' + pledge.Id +
                    ' on attempt ' + attempt + ': ' + error.getMessage());
            }
        }

        if (!retryIds.isEmpty() && attempt < MAX_ATTEMPTS) {
            System.enqueueJob(new AXSMapPledgePaymentWebhook(
                new Set<Id>(retryIds), attempt + 1
            ));
        }
    }

    @TestVisible
    private static void send(AXS_Map_Pledge__c pledge) {
        if (String.isBlank(pledge.AXS_Map_Pledge_ID__c) ||
            pledge.Donation_Opportunity__c == null ||
            !isSupportedStatus(pledge.Status__c)) {
            return;
        }

        Map<String, Object> body = new Map<String, Object>{
            'axsMapPledgeId' => pledge.AXS_Map_Pledge_ID__c,
            'status' => pledge.Status__c,
            'opportunityId' => String.valueOf(pledge.Donation_Opportunity__c),
            'paypalTransactionId' =>
                pledge.Donation_Opportunity__r.PayPal_Transaction_ID__c,
            'paymentDate' => pledge.Payment_Date__c,
            'receiptSent' =>
                pledge.Donation_Opportunity__r.Receipt_sent__c == true
        };

        HttpRequest request = new HttpRequest();
        request.setEndpoint(
            'callout:Access_Map_Production_API/donations/salesforce/payment-confirmation'
        );
        request.setMethod('POST');
        request.setHeader('Content-Type', 'application/json');
        request.setTimeout(20000);
        request.setBody(JSON.serialize(body));

        HttpResponse response = new Http().send(request);
        if (response.getStatusCode() < 200 || response.getStatusCode() >= 300) {
            throw new CalloutException(
                'AXS Map API returned HTTP ' + response.getStatusCode() +
                ': ' + response.getBody()
            );
        }
    }

    public static Boolean isSupportedStatus(String status) {
        return new Set<String>{
            'Payment Requested', 'Paid', 'Cancelled', 'Expired'
        }.contains(status);
    }
}
