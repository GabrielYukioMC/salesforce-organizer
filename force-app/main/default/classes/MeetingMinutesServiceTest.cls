@IsTest
private class MeetingMinutesServiceTest {

    // ─── Setup ───────────────────────────────────────────────
    @TestSetup
    static void setup() {
        Account acc = new Account(Name = 'Teste Elera POC');
        insert acc;
    }

    static Account getAccount() {
        return [SELECT Id FROM Account WHERE Name = 'Teste Elera POC' LIMIT 1];
    }

    // ─── Cenário 1: Criar nota com conteúdo válido ────────────
    @IsTest
    static void testCreateNote_success() {
        Account acc = getAccount();

        Test.startTest();
        String noteId = MeetingMinutesService.createNote(
            'Reunião Teste',
            'Conteúdo da ata de teste',
            acc.Id
        );
        Test.stopTest();

        System.assertNotEquals(null, noteId, 'Note ID deve ser retornado');
        Note n = [SELECT Title, Body, ParentId FROM Note WHERE Id = :noteId];
        System.assertEquals('Ata - Reunião Teste', n.Title);
        System.assertEquals(acc.Id, n.ParentId);
    }

    // ─── Cenário 2: Criar nota sem accountId ─────────────────
    @IsTest
    static void testCreateNote_missingAccountId() {
        Test.startTest();
        try {
            MeetingMinutesService.createNote('Teste', 'Conteúdo', '');
            System.assert(false, 'Deveria ter lançado exceção');
        } catch (IllegalArgumentException e) {
            System.assert(
                e.getMessage().contains('obrigatorio'),
                'Mensagem de erro incorreta'
            );
        }
        Test.stopTest();
    }

    // ─── Cenário 3: Extrair seção de próximos passos ─────────
    @IsTest
    static void testExtractSection_success() {
        String content =
            'PARTICIPANTES\nJoão, Maria\n\n' +
            'PROXIMOS PASSOS\n' +
            'Definir SLA | Pedro | Sexta\n' +
            'Levantar perfis | Maria | Quarta\n\n' +
            'RESUMO FINAL\nReunião produtiva.';

        Test.startTest();
        String section = MeetingTaskService.extractSection(
            content, 'PROXIMOS PASSOS'
        );
        Test.stopTest();

        System.assert(
            section.contains('Definir SLA'),
            'Seção deve conter próximos passos'
        );
        System.assert(
            !section.contains('RESUMO'),
            'Seção não deve conter seção seguinte'
        );
    }

    // ─── Cenário 4: Criar tasks a partir da ata ──────────────
    @IsTest
    static void testCreateTasksFromMinutes_success() {
        Account acc = getAccount();
        String content =
            'ATA DE REUNIÃO\n\n' +
            'PROXIMOS PASSOS\n' +
            'Definir o SLA por fase | Pedro | Sexta (04/04/2026)\n' +
            'Levantar perfis de permissão | Maria | Quarta (02/04/2026)\n' +
            'Documentar política de duplicidade | João | Quinta (03/04/2026)\n\n' +
            'RESUMO FINAL\nReunião produtiva.';

        Test.startTest();
        List<Task> tasks = MeetingTaskService.createTasksFromMinutes(
            content, acc.Id
        );
        Test.stopTest();

        System.assertEquals(3, tasks.size(), 'Devem ser criadas 3 tasks');
        List<Task> dbTasks = [
            SELECT Subject, WhatId, Status
            FROM Task
            WHERE WhatId = :acc.Id
        ];
        System.assertEquals(3, dbTasks.size());
        System.assertEquals('Not Started', dbTasks[0].Status);
    }

    // ─── Cenário 5: Nenhuma task sem seção de próximos passos ─
    @IsTest
    static void testCreateTasksFromMinutes_noSection() {
        Account acc = getAccount();
        String content = 'ATA DE REUNIÃO\nSem próximos passos definidos.';

        Test.startTest();
        List<Task> tasks = MeetingTaskService.createTasksFromMinutes(
            content, acc.Id
        );
        Test.stopTest();

        System.assertEquals(0, tasks.size(), 'Nenhuma task deve ser criada');
    }

    // ─── Cenário 6: InvocableMethod com payload válido ───────
    @IsTest
    static void testGenerateMeetingMinutes_invocable() {
        Account acc = getAccount();

        MeetingTranscriptPayload p = new MeetingTranscriptPayload();
        p.meetingTitle   = 'Reunião Invocable Test';
        p.meetingDate    = '28/03/2026';
        p.accountId      = acc.Id;
        p.transcriptText =
            'João: Precisamos definir SLA. | Pedro | Sexta\n' +
            'Maria: Falta política de duplicidade. | Maria | Quarta';

        // Mock do callout
        Test.setMock(HttpCalloutMock.class, new GeminiMockResponse());

        Test.startTest();
        List<MeetingTranscriptHandler.ActionResult> results =
            MeetingTranscriptHandler.generateMeetingMinutes(
                new List<MeetingTranscriptPayload>{ p }
            );
        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assert(
            results[0].status.startsWith('success'),
            'Status deve ser success'
        );
        System.assertNotEquals(null, results[0].noteId);
    }

    // ─── Cenário 7: InvocableMethod sem accountId ────────────
    @IsTest
    static void testGenerateMeetingMinutes_missingAccount() {
        MeetingTranscriptPayload p = new MeetingTranscriptPayload();
        p.meetingTitle   = 'Teste sem conta';
        p.meetingDate    = '28/03/2026';
        p.accountId      = '';
        p.transcriptText = 'Transcrição qualquer';

        Test.setMock(HttpCalloutMock.class, new GeminiMockResponse());

        Test.startTest();
        List<MeetingTranscriptHandler.ActionResult> results =
            MeetingTranscriptHandler.generateMeetingMinutes(
                new List<MeetingTranscriptPayload>{ p }
            );
        Test.stopTest();

        System.assert(
            results[0].status.startsWith('error'),
            'Deve retornar erro sem accountId'
        );
    }

    // ─── Mock do Gemini ───────────────────────────────────────
    private class GeminiMockResponse implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);
            res.setBody(JSON.serialize(new Map<String, Object>{
                'candidates' => new List<Object>{
                    new Map<String, Object>{
                        'content' => new Map<String, Object>{
                            'parts' => new List<Object>{
                                new Map<String, Object>{
                                    'text' =>
                                        'PARTICIPANTES\nJoão, Maria, Pedro\n\n' +
                                        'ASSUNTOS DISCUTIDOS\n1. SLA\n2. Duplicidade\n\n' +
                                        'PONTOS PRINCIPAIS\n- Definir SLA urgente\n\n' +
                                        'GAPS IDENTIFICADOS\n- SLA não definido\n\n' +
                                        'PROXIMOS PASSOS\n' +
                                        'Definir SLA | Pedro | Sexta\n' +
                                        'Levantar perfis | Maria | Quarta\n\n' +
                                        'RESUMO FINAL\nReunião produtiva.\n\n' +
                                        'USER STORIES\n' +
                                        'US-01 | SLA por fase\n' +
                                        'EU, COMO gestor, QUERO SLA definido\n' +
                                        'PARA garantir atendimento.\n' +
                                        'Cenario: SLA configurado\n' +
                                        '  Dado que o SLA está configurado\n' +
                                        '  Quando o lead ultrapassa o tempo\n' +
                                        '  Então o lead é redistribuído'
                                }
                            }
                        }
                    }
                }
            }));
            return res;
        }
    }
}