public without sharing class MetaService {

    public static void criarMeta(Meta__c novaMeta) {
        if (novaMeta == null) {
            throw new AuraHandledException('A meta não pode ser nula.');
        }
        if (novaMeta.Name == null || novaMeta.Name.trim() == '') {
            throw new AuraHandledException('O nome da meta é obrigatório.');
        }
        validarPercentuais(novaMeta);

        novaMeta.UsuarioProprietario__c = UserInfo.getUserId();

        if (novaMeta.Ativa__c) {
            desativarMetasDoUsuario();
        }

        insert novaMeta;
    }

    public static void atualizarMeta(Meta__c meta) {
        if (meta == null || meta.Id == null) {
            throw new AuraHandledException('Meta inválida para atualização.');
        }
        if (meta.Name == null || meta.Name.trim() == '') {
            throw new AuraHandledException('O nome da meta é obrigatório.');
        }
        validarPercentuais(meta);

        if (meta.Ativa__c) {
            desativarMetasDoUsuario();
        }

        update new Meta__c(
            Id                      = meta.Id,
            Name                    = meta.Name,
            GastosFixos__c          = meta.GastosFixos__c,
            ReservaEmergencia__c    = meta.ReservaEmergencia__c,
            Investimentos__c        = meta.Investimentos__c,
            QualidadeDeVida__c      = meta.QualidadeDeVida__c,
            DesenvolvimentoPessoal__c = meta.DesenvolvimentoPessoal__c,
            Objetivos__c            = meta.Objetivos__c,
            Ativa__c                = meta.Ativa__c,
            Descricao__c            = meta.Descricao__c
        );
    }

    public static void deletarMeta(Id metaId) {
        if (metaId == null) {
            throw new AuraHandledException('ID da meta não informado.');
        }
        delete new Meta__c(Id = metaId);
    }

    public static List<Meta__c> buscarMetasDoUsuario() {
        return MetaSelector.buscarMetasPorUsuario();
    }

    public static Meta__c buscarMetaAtiva() {
        List<Meta__c> lista = MetaSelector.buscarMetaAtivaPorUsuario();
        return lista.isEmpty() ? null : lista[0];
    }

    public static void ativarMeta(Id metaId) {
        if (metaId == null) {
            throw new AuraHandledException('ID da meta não informado.');
        }
        List<Meta__c> todasAsMetas = MetaSelector.buscarMetasPorUsuario();
        for (Meta__c m : todasAsMetas) {
            m.Ativa__c = (m.Id == metaId);
        }
        update todasAsMetas;
    }

    private static void validarPercentuais(Meta__c meta) {
        Decimal gf  = meta.GastosFixos__c          != null ? meta.GastosFixos__c          : 0;
        Decimal re  = meta.ReservaEmergencia__c     != null ? meta.ReservaEmergencia__c     : 0;
        Decimal inv = meta.Investimentos__c         != null ? meta.Investimentos__c         : 0;
        Decimal qv  = meta.QualidadeDeVida__c       != null ? meta.QualidadeDeVida__c       : 0;
        Decimal dp  = meta.DesenvolvimentoPessoal__c != null ? meta.DesenvolvimentoPessoal__c : 0;
        Decimal obj = meta.Objetivos__c             != null ? meta.Objetivos__c             : 0;
        Decimal soma = gf + re + inv + qv + dp + obj;
        if (soma != 100) {
            throw new AuraHandledException(
                'A soma dos percentuais deve ser exatamente 100%. Total atual: ' + soma.setScale(2) + '%'
            );
        }
    }

    private static void desativarMetasDoUsuario() {
        List<Meta__c> ativas = [
            SELECT Id FROM Meta__c
            WHERE OwnerId = :UserInfo.getUserId() AND Ativa__c = true
        ];
        for (Meta__c m : ativas) {
            m.Ativa__c = false;
        }
        if (!ativas.isEmpty()) {
            update ativas;
        }
    }
}
