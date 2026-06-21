public with sharing class TestRunnerService {

    public class TestScenario {
        public String name;
        public String status; // OK, FAIL, WARN
        public String details;
    }

    public class TestRunResult {
        public List<TestScenario> scenarios;
        public Integer total;
        public Integer passed;
        public Integer failed;
        public String aiAnalysis;

        public TestRunResult() {
            this.scenarios = new List<TestScenario>();
            this.total     = 0;
            this.passed    = 0;
            this.failed    = 0;
        }
    }

    // Executa todos os cenários de teste
    public static TestRunResult runTests(String accountId, String meetingMinutesId) {
        TestRunResult result = new TestRunResult();

        // Cenário 1: MeetingMinutes criado
        runScenario(result, 'MeetingMinutes criado',
            checkMeetingMinutes(accountId, meetingMinutesId));

        // Cenário 2: Conteúdo da ata não está vazio
        runScenario(result, 'Conteúdo da ata preenchido',
            checkAtaContent(meetingMinutesId));

        // Cenário 3: Transcrição salva
        runScenario(result, 'Transcrição salva no registro',
            checkTranscricao(meetingMinutesId));

        // Cenário 4: User Stories criadas
        runScenario(result, 'User Stories geradas',
            checkUserStories(meetingMinutesId));

        // Cenário 5: US com Status preenchido
        runScenario(result, 'User Stories com Status = Backlog',
            checkUSStatus(meetingMinutesId));

        // Cenário 6: US com Prioridade preenchida
        runScenario(result, 'User Stories com Prioridade preenchida',
            checkUSPrioridade(meetingMinutesId));

        

        // Cenário 8: Tasks criadas
        runScenario(result, 'Action Items / Tasks criados',
            checkTasks(accountId));

        // Cenário 9: Tasks com responsável
        runScenario(result, 'Tasks com responsável preenchido',
            checkTaskResponsavel(accountId));

        // Cenário 10: MeetingMinutes vinculado à Account
        runScenario(result, 'MeetingMinutes vinculado à Account',
            checkMeetingMinutesAccount(meetingMinutesId, accountId));

        // Análise da IA
        result.aiAnalysis = analyzeWithGemini(result);

        return result;
    }

    private static TestScenario checkMeetingMinutes(String accountId, String mmId) {
        TestScenario s = new TestScenario();
        s.name = 'MeetingMinutes criado';
        try {
            List<MeetingMinutes__c> mm = [
                SELECT Id, Name FROM MeetingMinutes__c
                WHERE Id = :mmId AND Account__c = :accountId LIMIT 1
            ];
            if (!mm.isEmpty()) {
                s.status  = 'OK';
                s.details = 'Registro encontrado: ' + mm[0].Name;
            } else {
                s.status  = 'FAIL';
                s.details = 'MeetingMinutes não encontrado para esta Account';
            }
        } catch (Exception e) {
            s.status  = 'FAIL';
            s.details = 'Erro: ' + e.getMessage();
        }
        return s;
    }

    private static TestScenario checkAtaContent(String mmId) {
        TestScenario s = new TestScenario();
        s.name = 'Conteúdo da ata preenchido';
        try {
            MeetingMinutes__c mm = [
                SELECT Conteudo_Ata__c FROM MeetingMinutes__c WHERE Id = :mmId LIMIT 1
            ];
            if (String.isNotBlank(mm.Conteudo_Ata__c) && mm.Conteudo_Ata__c.length() > 100) {
                s.status  = 'OK';
                s.details = 'Conteúdo com ' + mm.Conteudo_Ata__c.length() + ' caracteres';
            } else {
                s.status  = 'FAIL';
                s.details = 'Conteúdo vazio ou muito curto';
            }
        } catch (Exception e) {
            s.status  = 'FAIL';
            s.details = 'Erro: ' + e.getMessage();
        }
        return s;
    }

    private static TestScenario checkTranscricao(String mmId) {
        TestScenario s = new TestScenario();
        s.name = 'Transcrição salva';
        try {
            MeetingMinutes__c mm = [
                SELECT Transcricao__c FROM MeetingMinutes__c WHERE Id = :mmId LIMIT 1
            ];
            if (String.isNotBlank(mm.Transcricao__c)) {
                s.status  = 'OK';
                s.details = 'Transcrição salva com ' + mm.Transcricao__c.length() + ' caracteres';
            } else {
                s.status  = 'WARN';
                s.details = 'Transcrição não salva — verifique se o campo foi mapeado no Flow';
            }
        } catch (Exception e) {
            s.status  = 'FAIL';
            s.details = 'Erro: ' + e.getMessage();
        }
        return s;
    }

    private static TestScenario checkUserStories(String mmId) {
        TestScenario s = new TestScenario();
        s.name = 'User Stories geradas';
        try {
            Integer count = [
                SELECT COUNT() FROM UserStory__c WHERE Ata_de_Reuniao__c = :mmId
            ];
            if (count > 0) {
                s.status  = 'OK';
                s.details = count + ' User Stories geradas';
            } else {
                s.status  = 'FAIL';
                s.details = 'Nenhuma User Story encontrada para esta ata';
            }
        } catch (Exception e) {
            s.status  = 'FAIL';
            s.details = 'Erro: ' + e.getMessage();
        }
        return s;
    }

    private static TestScenario checkUSStatus(String mmId) {
        TestScenario s = new TestScenario();
        s.name = 'US com Status = Backlog';
        try {
            Integer total = [SELECT COUNT() FROM UserStory__c WHERE Ata_de_Reuniao__c = :mmId];
            Integer comStatus = [
                SELECT COUNT() FROM UserStory__c
                WHERE Ata_de_Reuniao__c = :mmId AND Status__c != null
            ];
            if (total > 0 && total == comStatus) {
                s.status  = 'OK';
                s.details = 'Todas as ' + total + ' US têm Status preenchido';
            } else {
                s.status  = 'WARN';
                s.details = comStatus + ' de ' + total + ' US com Status preenchido';
            }
        } catch (Exception e) {
            s.status  = 'FAIL';
            s.details = 'Erro: ' + e.getMessage();
        }
        return s;
    }

    private static TestScenario checkUSPrioridade(String mmId) {
        TestScenario s = new TestScenario();
        s.name = 'US com Prioridade preenchida';
        try {
            Integer total = [SELECT COUNT() FROM UserStory__c WHERE Ata_de_Reuniao__c = :mmId];
            Integer comPrio = [
                SELECT COUNT() FROM UserStory__c
                WHERE Ata_de_Reuniao__c = :mmId AND Prioridade__c != null
            ];
            if (total > 0 && total == comPrio) {
                s.status  = 'OK';
                s.details = 'Todas as ' + total + ' US têm Prioridade preenchida';
            } else {
                s.status  = 'WARN';
                s.details = comPrio + ' de ' + total + ' US com Prioridade preenchida';
            }
        } catch (Exception e) {
            s.status  = 'FAIL';
            s.details = 'Erro: ' + e.getMessage();
        }
        return s;
    }

   
    private static TestScenario checkTasks(String accountId) {
        TestScenario s = new TestScenario();
        s.name = 'Tasks criadas';
        try {
            Integer count = [
                SELECT COUNT() FROM Task
                WHERE WhatId = :accountId
                AND CreatedDate = TODAY
            ];
            if (count > 0) {
                s.status  = 'OK';
                s.details = count + ' Tasks criadas hoje para esta Account';
            } else {
                s.status  = 'WARN';
                s.details = 'Nenhuma Task criada hoje — verifique os próximos passos da ata';
            }
        } catch (Exception e) {
            s.status  = 'FAIL';
            s.details = 'Erro: ' + e.getMessage();
        }
        return s;
    }

    private static TestScenario checkTaskResponsavel(String accountId) {
        TestScenario s = new TestScenario();
        s.name = 'Tasks com responsável';
        try {
            List<Task> tasks = [
                SELECT Id, Description FROM Task
                WHERE WhatId = :accountId AND CreatedDate = TODAY
            ];
            Integer comResp = 0;
            for (Task t : tasks) {
                if (String.isNotBlank(t.Description) && t.Description.contains('Responsável:')) {
                    comResp++;
                }
            }
            if (tasks.size() > 0 && tasks.size() == comResp) {
                s.status  = 'OK';
                s.details = 'Todas as ' + tasks.size() + ' Tasks têm responsável';
            } else {
                s.status  = 'WARN';
                s.details = comResp + ' de ' + tasks.size() + ' Tasks com responsável';
            }
        } catch (Exception e) {
            s.status  = 'FAIL';
            s.details = 'Erro: ' + e.getMessage();
        }
        return s;
    }

    private static TestScenario checkMeetingMinutesAccount(String mmId, String accountId) {
        TestScenario s = new TestScenario();
        s.name = 'MeetingMinutes vinculado à Account';
        try {
            MeetingMinutes__c mm = [
                SELECT Account__c FROM MeetingMinutes__c WHERE Id = :mmId LIMIT 1
            ];
            if (mm.Account__c == accountId) {
                s.status  = 'OK';
                s.details = 'Vínculo correto com Account ' + accountId;
            } else {
                s.status  = 'FAIL';
                s.details = 'MeetingMinutes vinculado a Account diferente';
            }
        } catch (Exception e) {
            s.status  = 'FAIL';
            s.details = 'Erro: ' + e.getMessage();
        }
        return s;
    }

    private static void runScenario(TestRunResult result, String name, TestScenario scenario) {
        result.scenarios.add(scenario);
        result.total++;
        if (scenario.status == 'OK') result.passed++;
        else if (scenario.status == 'FAIL') result.failed++;
    }

    // Análise da IA sobre os resultados
    private static String analyzeWithGemini(TestRunResult result) {
        String prompt = 'Você é um especialista em qualidade de software Salesforce.\n'
            + 'Analise os resultados dos testes abaixo e forneça:\n'
            + '1. Diagnóstico geral\n'
            + '2. Pontos críticos que precisam de correção\n'
            + '3. Sugestões de melhoria\n'
            + '4. Nota de qualidade de 0 a 10\n\n'
            + 'RESULTADOS:\n'
            + 'Total: ' + result.total + ' | Passou: ' + result.passed
            + ' | Falhou: ' + result.failed + '\n\n';

        for (TestScenario s : result.scenarios) {
            prompt += '[' + s.status + '] ' + s.name + ': ' + s.details + '\n';
        }

        try {
            Http http = new Http();
            HttpRequest req = new HttpRequest();
            req.setEndpoint(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='
    + MeetingMinutesService.GEMINI_API_KEY
);
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setTimeout(60000);
            req.setBody('{"contents":[{"parts":[{"text":' + JSON.serialize(prompt) + '}]}]}');

            HttpResponse res = http.send(req);
            if (res.getStatusCode() == 200) {
                Map<String, Object> result2 =
                    (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                List<Object> candidates = (List<Object>) result2.get('candidates');
                Map<String, Object> first = (Map<String, Object>) candidates[0];
                Map<String, Object> cnt = (Map<String, Object>) first.get('content');
                List<Object> parts = (List<Object>) cnt.get('parts');
                Map<String, Object> p = (Map<String, Object>) parts[0];
                return (String) p.get('text');
            }
        } catch (Exception e) {
            return 'Análise da IA indisponível: ' + e.getMessage();
        }
        return 'Análise da IA indisponível';
    }

    // Formata resultado para salvar no TestReport__c
    public static String formatResult(TestRunResult result) {
        String out = '========== RELATÓRIO DE TESTES ==========\n';
        out += 'Total: ' + result.total + ' | ✅ ' + result.passed
            + ' | ❌ ' + result.failed + '\n';
        out += '=========================================\n\n';

        for (TestScenario s : result.scenarios) {
            String icon = s.status == 'OK' ? '✅' : (s.status == 'FAIL' ? '❌' : '⚠️');
            out += icon + ' ' + s.name + '\n';
            out += '   → ' + s.details + '\n\n';
        }

        out += '=========================================\n';
        out += '🤖 ANÁLISE DA IA:\n\n' + result.aiAnalysis;
        return out;
    }
}