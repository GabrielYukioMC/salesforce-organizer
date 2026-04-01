public without sharing class ApontamentoFixoController {

    @AuraEnabled(cacheable=true)
    public static List<ApontamentoFixo__c> buscarRotinas() {
        return ApontamentoFixoSelector.buscarPorUsuario(UserInfo.getUserId());
    }

    @AuraEnabled
    public static void salvarRotina(ApontamentoFixo__c rotina) {
        ApontamentoFixoService.salvarRotina(rotina);
    }

    @AuraEnabled
    public static void deletarRotina(Id rotinaId) {
        ApontamentoFixoService.deletarRotina(rotinaId);
    }

    @AuraEnabled
    public static void gerarApontamentosSemana(String semanaInicioISO) {
        ApontamentoFixoService.gerarApontamentosSemana(semanaInicioISO);
    }
}
