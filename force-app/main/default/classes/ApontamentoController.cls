public without sharing class ApontamentoController {

    @AuraEnabled
    public static List<ApontamentoDeHoras__c> buscarPorSemana(String semanaInicioISO) {
        Date semanaInicio = Date.valueOf(semanaInicioISO);
        Datetime inicio   = Datetime.newInstance(semanaInicio, Time.newInstance(0, 0, 0, 0));
        Datetime fim      = Datetime.newInstance(semanaInicio.addDays(7), Time.newInstance(0, 0, 0, 0));
        return ApontamentoSelector.buscarPorPeriodo(UserInfo.getUserId(), inicio, fim);
    }
}
