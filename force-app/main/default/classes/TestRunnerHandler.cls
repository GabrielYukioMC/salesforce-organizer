public with sharing class TestRunnerHandler {

    @InvocableMethod(
        label='Executar Testes da Ata'
        description='Executa cenários de teste e gera relatório via IA'
    )
    public static List<String> executeTests(List<String> accountIds) {
        List<String> results = new List<String>();

        for (String accountId : accountIds) {
            try {
                // Busca o MeetingMinutes mais recente da Account
                List<MeetingMinutes__c> mms = [
                    SELECT Id FROM MeetingMinutes__c
                    WHERE Account__c = :accountId
                    ORDER BY CreatedDate DESC
                    LIMIT 1
                ];

                if (mms.isEmpty()) {
                    results.add('error|Nenhuma Ata encontrada para esta Account');
                    continue;
                }

                String mmId = mms[0].Id;

                // Executa os testes
                TestRunnerService.TestRunResult testResult =
                    TestRunnerService.runTests(accountId, mmId);

                // Formata o relatório
                String reportContent = TestRunnerService.formatResult(testResult);

                // Salva o TestReport__c
                TestReport__c report = new TestReport__c();
                report.Name               = 'Teste - ' + System.now().format();
                report.Account__c         = accountId;
                report.MeetingMinutes__c  = mmId;
                report.Resultado__c       = reportContent;
                report.Total_Cenarios__c  = testResult.total;
                report.Cenarios_OK__c     = testResult.passed;
                report.Cenarios_Falhos__c = testResult.failed;
                report.Status_Geral__c    = testResult.failed == 0 ? 'Aprovado'
                    : (testResult.passed > 0 ? 'Parcial' : 'Reprovado');
                insert report;

                results.add('success|' + report.Id);

            } catch (Exception e) {
                results.add('error|' + e.getMessage());
            }
        }
        return results;
    }
}