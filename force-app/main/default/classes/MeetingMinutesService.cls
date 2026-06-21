public with sharing class MeetingMinutesService {

    public static final String GEMINI_API_KEY = '... depois coloca o token aqui via algum metadata ou custom setting... estou subindo no git';
 private static final String GEMINI_ENDPOINT = 
    'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=';

 public static String fetchTranscript(String url) {
        Http http = new Http();
        HttpRequest req = new HttpRequest();
        req.setEndpoint(url);
        req.setMethod('GET');
        req.setTimeout(30000);
        HttpResponse res = http.send(req);
        if (res.getStatusCode() == 200) return res.getBody();
        throw new CalloutException('Erro ao buscar transcricao: ' + res.getStatusCode());
    }

    // Busca a imagem mais recente anexada à Account
    public static String fetchLatestImageBase64(String accountId) {
        List<ContentDocumentLink> links = [
            SELECT ContentDocumentId
            FROM ContentDocumentLink
            WHERE LinkedEntityId = :accountId
            ORDER BY SystemModstamp DESC
            LIMIT 10
        ];

        if (links.isEmpty()) return null;

        Set<Id> docIds = new Set<Id>();
        for (ContentDocumentLink l : links) docIds.add(l.ContentDocumentId);

        List<ContentVersion> versions = [
            SELECT Id, Title, FileType, VersionData
            FROM ContentVersion
            WHERE ContentDocumentId IN :docIds
            AND IsLatest = true
            AND FileType IN ('JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'HEIC')
            ORDER BY CreatedDate DESC
            LIMIT 1
        ];

        if (versions.isEmpty()) return null;

        return EncodingUtil.base64Encode(versions[0].VersionData);
    }

    // Extrai texto da imagem via Gemini Vision
    public static String extractTextFromImage(String base64Image, String mimeType) {
        if (String.isBlank(base64Image)) return null;

        String prompt = 'Você está recebendo uma imagem de anotações manuscritas ou digitadas de uma reunião de negócios.\n'
            + 'Extraia TODO o texto visível na imagem, mantendo a estrutura original.\n'
            + 'Se houver listas, mantenha os bullets. Se houver títulos, mantenha-os.\n'
            + 'Retorne apenas o texto extraído, sem comentários adicionais.';

        String body = '{'
            + '"contents":[{"parts":['
            + '{"text":' + JSON.serialize(prompt) + '},'
            + '{"inline_data":{"mime_type":"' + (mimeType != null ? mimeType : 'image/jpeg') + '","data":"' + base64Image + '"}}'
            + ']}]}';

        Http http = new Http();
        HttpRequest req = new HttpRequest();
        req.setEndpoint(GEMINI_ENDPOINT + GEMINI_API_KEY);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setTimeout(120000);
        req.setBody(body);

        HttpResponse res = http.send(req);
        if (res.getStatusCode() == 200) {
            Map<String, Object> result =
                (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            List<Object> candidates = (List<Object>) result.get('candidates');
            Map<String, Object> first = (Map<String, Object>) candidates[0];
            Map<String, Object> cnt = (Map<String, Object>) first.get('content');
            List<Object> parts = (List<Object>) cnt.get('parts');
            Map<String, Object> p = (Map<String, Object>) parts[0];
            return (String) p.get('text');
        }
        throw new CalloutException('Gemini Vision error: ' + res.getStatusCode() + ' - ' + res.getBody());
    }

    public static String generateMinutes(MeetingTranscriptPayload payload) {
        String transcriptText = payload.transcriptText;

        if (String.isBlank(transcriptText) && String.isNotBlank(payload.transcriptUrl)) {
            transcriptText = fetchTranscript(payload.transcriptUrl);
        }
        if (String.isBlank(transcriptText)) {
            throw new IllegalArgumentException('Nenhuma transcricao encontrada.');
        }

        String participantsList = (payload.participants != null && !payload.participants.isEmpty())
            ? String.join(payload.participants, ', ')
            : 'Extrair da transcricao';

        // ─── Busca anotações: texto manual OU imagem anexada ───
        String anotacoesTexto = payload.anotacoes;

        if (String.isBlank(anotacoesTexto) && String.isNotBlank(payload.accountId)) {
            try {
                String base64Image = fetchLatestImageBase64(payload.accountId);
                if (String.isNotBlank(base64Image)) {
                    System.debug('📸 Imagem encontrada — extraindo texto via Gemini Vision...');
                    anotacoesTexto = extractTextFromImage(base64Image, 'image/jpeg');
                    System.debug('📝 Texto extraído da imagem: ' + anotacoesTexto);
                }
            } catch (Exception e) {
                System.debug('⚠️ Erro ao processar imagem: ' + e.getMessage());
            }
        }

        // ─── CHAMADA 1: Analisa transcrição e gera ata base por temas ───
        String prompt1 = 'Voce e um assistente especializado em reunioes de negocios.\n'
            + 'Com base na transcricao abaixo, gere uma ata estruturada em portugues brasileiro.\n\n'
            + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
            + 'PARTE 1 — ATA GERAL DA REUNIAO\n'
            + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
            + '1. PARTICIPANTES\n'
            + '2. ASSUNTOS DISCUTIDOS\n'
            + '3. PONTOS PRINCIPAIS\n'
            + '4. RESUMO FINAL\n\n'
            + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
            + 'PARTE 2 — BLOCOS TEMATICOS (da transcricao)\n'
            + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
            + 'Identifique automaticamente os grandes temas abordados.\n'
            + 'Para cada tema use EXATAMENTE esta estrutura:\n\n'
            + '## TEMA: [Nome do Tema em maiusculas]\n\n'
            + '### CONTEXTO\n'
            + '[Resumo do que foi discutido sobre este tema]\n\n'
            + '### GAPS IDENTIFICADOS\n'
            + '- [Gap 1]: descricao\n\n'
            + '### PROXIMOS PASSOS\n'
            + '| Acao | Responsavel | Prazo |\n'
            + '|------|-------------|-------|\n'
            + '| [acao] | [responsavel] | [prazo] |\n\n'
            + '### USER STORIES\n'
            + 'US-01 | [Titulo] | Prioridade: [Alta/Media/Baixa]\n'
            + 'EU, COMO [perfil], QUERO [funcionalidade] PARA [beneficio]\n'
            + 'Criterios (Gherkin):\n'
            + 'Cenario: [nome]\n'
            + '  Dado que [contexto]\n'
            + '  Quando [acao]\n'
            + '  Entao [resultado]\n\n'
            + 'Regras:\n'
            + '- Identifique entre 2 e 6 temas principais\n'
            + '- Cada tema deve ter pelo menos 1 gap e 1 US\n'
            + '- Prioridade Alta: gap critico que impacta o negocio\n'
            + '- Prioridade Media: gap importante com workaround possivel\n'
            + '- Prioridade Baixa: melhoria ou otimizacao\n\n'
            + 'Participantes: ' + participantsList + '\n'
            + 'Data: ' + payload.meetingDate + '\n\n'
            + 'TRANSCRICAO:\n' + transcriptText;

        String ataBase = callGemini(prompt1);

        // ─── CHAMADA 2: Cruza anotações com a ata base por temas ───
        String ataFinal = ataBase;

        if (String.isNotBlank(anotacoesTexto)) {
            String fonteAnotacoes = String.isNotBlank(payload.anotacoes)
                ? 'texto digitado pelo usuario'
                : 'imagem/foto extraida via Gemini Vision';

            String prompt2 = 'Voce e um assistente especializado em reunioes de negocios.\n\n'
                + 'Abaixo voce tem:\n'
                + '1. Uma ATA BASE gerada a partir da transcricao de uma reuniao\n'
                + '2. ANOTACOES adicionais (' + fonteAnotacoes + ')\n\n'
                + 'Sua tarefa e ENRIQUECER a ata base cruzando as informacoes das anotacoes.\n\n'
                + 'Regras IMPORTANTES:\n'
                + '- Mantenha EXATAMENTE a mesma estrutura da ata base (PARTE 1, PARTE 2, temas)\n'
                + '- Para cada ## TEMA existente, adicione informacoes das anotacoes se houver\n'
                + '- Se as anotacoes mencionarem novos temas, crie novos blocos ## TEMA\n'
                + '- Em cada tema, adicione:\n\n'
                + '  ### ENRIQUECIMENTO DAS ANOTACOES\n'
                + '  [Informacoes das anotacoes que complementam este tema]\n\n'
                + '  ### GAPS ADICIONAIS (das anotacoes)\n'
                + '  - [Gap identificado apenas nas anotacoes]\n\n'
                + '  ### USER STORIES ADICIONAIS (das anotacoes)\n'
                + '  US-XX | [Titulo] | Prioridade: [Alta/Media/Baixa]\n'
                + '  EU, COMO [perfil], QUERO [funcionalidade] PARA [beneficio]\n'
                + '  Criterios (Gherkin):\n'
                + '  Cenario: [nome]\n'
                + '    Dado que [contexto]\n'
                + '    Quando [acao]\n'
                + '    Entao [resultado]\n\n'
                + '- Ao final gere:\n\n'
                + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
                + 'PARTE 3 — CONSOLIDADO FINAL\n'
                + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
                + '5. TODOS OS PROXIMOS PASSOS\n'
                + '   | Acao | Responsavel | Prazo | Tema | Fonte |\n'
                + '   |------|-------------|-------|------|-------|\n'
                + '   (Fonte = Transcricao ou Anotacao)\n\n'
                + '6. TODOS OS GAPS CONSOLIDADOS\n'
                + '7. TODAS AS USER STORIES CONSOLIDADAS\n\n'
                + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
                + 'ATA BASE:\n'
                + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
                + ataBase + '\n\n'
                + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
                + 'ANOTACOES (' + fonteAnotacoes + '):\n'
                + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
                + anotacoesTexto;

            ataFinal = callGemini(prompt2);
        } else {
            String prompt3 = 'Com base na ata abaixo, gere apenas:\n\n'
                + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
                + 'PARTE 3 — CONSOLIDADO FINAL\n'
                + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
                + '5. TODOS OS PROXIMOS PASSOS\n'
                + '   | Acao | Responsavel | Prazo | Tema |\n'
                + '   |------|-------------|-------|------|\n\n'
                + '6. TODOS OS GAPS\n'
                + '7. TODAS AS USER STORIES\n\n'
                + 'ATA:\n' + ataBase;

            String consolidado = callGemini(prompt3);
            ataFinal = ataBase + '\n\n' + consolidado;
        }

        String header = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
            + 'ATA DE REUNIAO - ' + payload.meetingDate + '\n'
            + 'Reuniao: ' + payload.meetingTitle + '\n'
            + 'Gerado via Gemini AI\n'
            + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

        return header + ataFinal;
    }

    public static String createMeetingMinutes(
        String title,
        String content,
        String transcriptText,
        String accountId,
        String meetingDate
    ) {
        if (String.isBlank(accountId)) {
            throw new IllegalArgumentException('accountId e obrigatorio.');
        }

        MeetingMinutes__c mm = new MeetingMinutes__c();
        mm.Name              = 'Ata - ' + title;
        mm.Account__c        = accountId;
        mm.Conteudo_Ata__c   = content;
        mm.Transcricao__c    = transcriptText;

        if (String.isNotBlank(meetingDate)) {
            try {
                mm.Data_Reuniao__c = Date.parse(meetingDate);
            } catch (Exception e) {
                mm.Data_Reuniao__c = Date.today();
            }
        }

        insert mm;
        return mm.Id;
    }

    private static String callGemini(String prompt) {
        String body = '{"contents":[{"parts":[{"text":'
            + JSON.serialize(prompt) + '}]}]}';
        return callGeminiRaw(body);
    }

    private static String callGeminiRaw(String body) {
        Http http = new Http();
        HttpRequest req = new HttpRequest();
        req.setEndpoint(GEMINI_ENDPOINT + GEMINI_API_KEY);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setTimeout(120000);
        req.setBody(body);

        HttpResponse res = http.send(req);
        if (res.getStatusCode() == 200) {
            Map<String, Object> result =
                (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            List<Object> candidates = (List<Object>) result.get('candidates');
            Map<String, Object> first = (Map<String, Object>) candidates[0];
            Map<String, Object> cnt = (Map<String, Object>) first.get('content');
            List<Object> parts = (List<Object>) cnt.get('parts');
            Map<String, Object> p = (Map<String, Object>) parts[0];
            return (String) p.get('text');
        }
        throw new CalloutException('Gemini error: ' + res.getStatusCode() + ' - ' + res.getBody());
    }
}