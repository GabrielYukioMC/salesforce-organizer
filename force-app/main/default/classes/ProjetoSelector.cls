public without sharing class ProjetoSelector {

    public static List<Projeto__c> buscarTodos() {
        return [
            SELECT Id, Name, Perfil_Alocacao__c, Id_Elera__c, Id_Perfil_Alocacao_Elera__c
            FROM Projeto__c
            ORDER BY Name ASC
        ];
    }
}
