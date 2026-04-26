public without sharing class EnvioApontamentoController {

    @AuraEnabled
    public static EnvioApontamentoService.ResultadoEnvio enviarSemana(String semanaInicioISO) {
        try {
            return EnvioApontamentoService.enviarSemana(semanaInicioISO);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}
