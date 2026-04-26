public without sharing class TransferenciaController {
    @AuraEnabled
    public static void realizarTransferencia(Transacao__c novaTransferencia) {
        try {
            TransferenciaService.realizarTransferencia(novaTransferencia);
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void deletarTransacao(Id transacaoId) {
        try {
            TransferenciaService.deletarTransacao(transacaoId);
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void atualizarTransacao(Transacao__c transacao) {
        try {
            TransferenciaService.atualizarTransacao(transacao);
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Transacao__c> getContasAPagar() {
        try {
            return TransferenciaService.getContasAPagar();
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String,Object>> getResumoMensal(Integer meses) {
        try {
            return TransferenciaService.getResumoMensal(meses);
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, Decimal> getTotaisPatrimonioAtual() {
        try {
            return TransferenciaService.getTotaisPatrimonioAtual();
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static List<Transacao__c> getTransacoesPorUsuarioEData(String data) {
        try {
            return TransferenciaService.getTransacoesPorUsuarioEData(data);
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}