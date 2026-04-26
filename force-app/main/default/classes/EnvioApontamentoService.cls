public without sharing class EnvioApontamentoService {

    private static final String API_VERSION = 'v65.0';

    public class ResultadoEnvio {
        @AuraEnabled public Integer enviados;
        @AuraEnabled public Integer erros;
        @AuraEnabled public Integer pulados;
        @AuraEnabled public List<String> mensagensErro;
        @AuraEnabled public Integer total;
    }

    public static ResultadoEnvio enviarSemana(String semanaInicioISO) {
        IntegracaoElera__c config = IntegracaoElera__c.getOrgDefaults();
        if (config == null || String.isBlank(config.Endpoint__c) || String.isBlank(config.Token1__c)) {
            throw new AuraHandledException('Configuração da integração Elera não encontrada. Acesse Setup → Custom Settings → IntegracaoElera e preencha Endpoint e Token.');
        }

        String endpoint = config.Endpoint__c.removeEnd('/') + '/services/data/' + API_VERSION + '/composite/sobjects';
        String token    = config.Token1__c.trim() + (String.isNotBlank(config.Token2__c) ? config.Token2__c.trim() : '');

        Date semanaInicio = Date.valueOf(semanaInicioISO);
        Datetime inicio   = Datetime.newInstance(semanaInicio, Time.newInstance(0, 0, 0, 0));
        Datetime fim      = Datetime.newInstance(semanaInicio.addDays(7), Time.newInstance(0, 0, 0, 0));

        List<ApontamentoDeHoras__c> aps = ApontamentoSelector.buscarParaEnvio(
            UserInfo.getUserId(), inicio, fim
        );

        ResultadoEnvio resultado = new ResultadoEnvio();
        resultado.enviados      = 0;
        resultado.erros         = 0;
        resultado.pulados       = 0;
        resultado.mensagensErro = new List<String>();
        resultado.total         = aps.size();

        if (aps.isEmpty()) return resultado;

        // Só envia apontamentos que tenham PerfilDeAlocacao__c resolvido
        // Prioridade: ProjetoLookup__r (relacionamento) → PerfilDeAlocacao__c direto no apontamento
        List<Map<String, Object>> records    = new List<Map<String, Object>>();
        List<ApontamentoDeHoras__c> apsEnvio = new List<ApontamentoDeHoras__c>();

        for (ApontamentoDeHoras__c ap : aps) {
            String perfilElera  = null;
            String projetoElera = null;

            // 1. Tenta resolver pelo lookup ao Projeto__c
            if (ap.ProjetoLookup__r != null) {
                if (String.isNotBlank(ap.ProjetoLookup__r.Id_Perfil_Alocacao_Elera__c)) {
                    perfilElera = ap.ProjetoLookup__r.Id_Perfil_Alocacao_Elera__c;
                }
                if (String.isNotBlank(ap.ProjetoLookup__r.Id_Elera__c)) {
                    projetoElera = ap.ProjetoLookup__r.Id_Elera__c;
                }
            }

            // 2. Fallback: PerfilDeAlocacao__c direto no apontamento (ID Elera já gravado)
            if (String.isBlank(perfilElera) && String.isNotBlank(ap.PerfilDeAlocacao__c)) {
                perfilElera = ap.PerfilDeAlocacao__c;
            }

            // Sem perfil → pula
            if (String.isBlank(perfilElera)) {
                resultado.pulados++;
                System.debug('### EnvioElera PULADO [' + ap.Name + '] — sem PerfilDeAlocacao mapeado. Id=' + ap.Id);
                continue;
            }

            Map<String, Object> rec = new Map<String, Object>();
            rec.put('attributes',         new Map<String, Object>{ 'type' => 'ApontamentoDeHoras__c' });
            rec.put('Name',               ap.Name);
            rec.put('Inicio__c',          ap.Inicio__c);
            rec.put('Fim__c',             ap.Fim__c);
            rec.put('Observacoes__c',     ap.Observacoes__c);
            rec.put('PerfilDeAlocacao__c', perfilElera);
            // DuracaoHoras__c, TempoMinutos__c, HoraInicio__c, Data_Inicio__c, MesAno__c, DescricaoPerfilDeAlocacao__c
            // são fórmulas na Elera — calculadas automaticamente, não podem ser enviadas

            if (String.isNotBlank(projetoElera)) {
                rec.put('Projeto__c', projetoElera);
            }

            records.add(rec);
            apsEnvio.add(ap);
        }

        if (records.isEmpty()) return resultado;

        Map<String, Object> body = new Map<String, Object>{
            'allOrNone' => false,
            'records'   => records
        };

        HttpRequest req = new HttpRequest();
        req.setEndpoint(endpoint);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Authorization', 'Bearer ' + token);
        req.setBody(JSON.serialize(body));
        req.setTimeout(120000);

        HttpResponse res = new Http().send(req);

        System.debug('### EnvioElera HTTP ' + res.getStatusCode() + ' | body=' + res.getBody());

        if (res.getStatusCode() != 200 && res.getStatusCode() != 201) {
            throw new AuraHandledException(
                'Erro HTTP ' + res.getStatusCode() + ': ' + res.getBody()
            );
        }

        List<Object> resBody = (List<Object>) JSON.deserializeUntyped(res.getBody());
        List<ApontamentoDeHoras__c> paraMarcar = new List<ApontamentoDeHoras__c>();

        for (Integer i = 0; i < resBody.size(); i++) {
            Map<String, Object> r = (Map<String, Object>) resBody[i];
            if ((Boolean) r.get('success')) {
                resultado.enviados++;
                paraMarcar.add(new ApontamentoDeHoras__c(
                    Id           = apsEnvio[i].Id,
                    JaEnviado__c = true
                ));
            } else {
                resultado.erros++;
                System.debug('### EnvioElera ERRO [' + apsEnvio[i].Name + '] Id=' + apsEnvio[i].Id + ' | resposta=' + JSON.serialize(r));
                List<Object> erros = (List<Object>) r.get('errors');
                if (erros != null && !erros.isEmpty()) {
                    Map<String, Object> e = (Map<String, Object>) erros[0];
                    resultado.mensagensErro.add(apsEnvio[i].Name + ': ' + JSON.serialize(e));
                }
            }
        }

        if (!paraMarcar.isEmpty()) {
            update paraMarcar;
        }

        return resultado;
    }
}
