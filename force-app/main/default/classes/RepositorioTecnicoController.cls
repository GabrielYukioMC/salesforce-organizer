public without sharing class RepositorioTecnicoController {
    private static final String STATUS_ARQUIVADO = 'Arquivado';
    private static final String STATUS_ATIVO = 'Ativo';

    @AuraEnabled(cacheable=true)
    public static List<ClienteRepositorio__c> getClientes() {
        assertReadable(ClienteRepositorio__c.SObjectType, 'Cliente Repositório');

        List<ClienteRepositorio__c> clientes = [
            SELECT Id, Name, Ativo__c, Descricao__c, Observacoes__c
            FROM ClienteRepositorio__c
            WHERE Ativo__c = true
            ORDER BY Name ASC
        ];
        return stripClientes(clientes);
    }

    @AuraEnabled(cacheable=true)
    public static List<ProjetoRepositorio__c> getProjetosByCliente(Id clienteId) {
        requireId(clienteId, 'Cliente');
        assertReadable(ProjetoRepositorio__c.SObjectType, 'Projeto Repositório');

        List<ProjetoRepositorio__c> projetos = [
            SELECT Id, Name, Cliente__c, Cliente__r.Name, Ativo__c, Descricao__c
            FROM ProjetoRepositorio__c
            WHERE Cliente__c = :clienteId AND Ativo__c = true
            ORDER BY Name ASC
        ];
        return stripProjetos(projetos);
    }

    @AuraEnabled(cacheable=true)
    public static List<RegistroRepositorio__c> getRegistros(Id clienteId, Id projetoId, String tipo) {
        requireId(clienteId, 'Cliente');
        requireId(projetoId, 'Projeto');
        requireText(tipo, 'Tipo');
        assertReadable(RegistroRepositorio__c.SObjectType, 'Registro Repositório');

        List<RegistroRepositorio__c> registros = [
            SELECT
                Id,
                Name,
                Cliente__c,
                Cliente__r.Name,
                Projeto__c,
                Projeto__r.Name,
                Tipo__c,
                Status__c,
                Resumo__c,
                Conteudo__c,
                Criticidade__c,
                Risco__c,
                Ambiente__c,
                Tags__c,
                ObjetoSalesforce__c,
                ClasseOuFlow__c,
                Ordem__c,
                Sintoma__c,
                CausaProvavel__c,
                ComoInvestigar__c,
                ComoResolver__c,
                ComoValidar__c,
                QuandoUsar__c,
                Parametros__c,
                QuerySOQL__c,
                ComoInterpretar__c,
                Objetivo__c,
                ExigeBackup__c,
                ExigeAprovacao__c,
                ScriptApex__c,
                Rollback__c,
                MensagemErro__c,
                OndeAcontece__c,
                SolucaoConhecida__c,
                PreRequisitos__c,
                Passos__c,
                Cuidados__c,
                ResultadoEsperado__c,
                LastModifiedDate
            FROM RegistroRepositorio__c
            WHERE
                Cliente__c = :clienteId
                AND Projeto__c = :projetoId
                AND Tipo__c = :tipo
                AND Status__c != :STATUS_ARQUIVADO
            ORDER BY Ordem__c ASC NULLS LAST, LastModifiedDate DESC
        ];
        return stripRegistros(registros);
    }

    @AuraEnabled
    public static ClienteRepositorio__c criarCliente(ClienteRepositorio__c cliente) {
        assertCreateable(ClienteRepositorio__c.SObjectType, 'Cliente Repositório');
        if (cliente == null) {
            throw new AuraHandledException('O cliente é obrigatório.');
        }
        requireText(cliente.Name, 'Nome do cliente');

        ClienteRepositorio__c novoCliente = new ClienteRepositorio__c(
            Name = cliente.Name.trim(),
            Ativo__c = cliente.Ativo__c == null ? true : cliente.Ativo__c,
            Descricao__c = cliente.Descricao__c,
            Observacoes__c = cliente.Observacoes__c
        );

        novoCliente = (ClienteRepositorio__c) stripForCreate(new List<SObject>{ novoCliente })[0];
        insert novoCliente;
        return getClienteById(novoCliente.Id);
    }

    @AuraEnabled
    public static ProjetoRepositorio__c criarProjeto(ProjetoRepositorio__c projeto) {
        assertCreateable(ProjetoRepositorio__c.SObjectType, 'Projeto Repositório');
        if (projeto == null) {
            throw new AuraHandledException('O projeto é obrigatório.');
        }
        requireText(projeto.Name, 'Nome do projeto');
        requireId(projeto.Cliente__c, 'Cliente');

        ProjetoRepositorio__c novoProjeto = new ProjetoRepositorio__c(
            Name = projeto.Name.trim(),
            Cliente__c = projeto.Cliente__c,
            Ativo__c = projeto.Ativo__c == null ? true : projeto.Ativo__c,
            Descricao__c = projeto.Descricao__c
        );

        novoProjeto = (ProjetoRepositorio__c) stripForCreate(new List<SObject>{ novoProjeto })[0];
        insert novoProjeto;
        return getProjetoById(novoProjeto.Id);
    }

    @AuraEnabled
    public static RegistroRepositorio__c salvarRegistro(RegistroRepositorio__c registro) {
        if (registro == null) {
            throw new AuraHandledException('O registro é obrigatório.');
        }
        if (String.isBlank(registro.Status__c)) {
            registro.Status__c = STATUS_ATIVO;
        }
        validarRegistro(registro);

        Boolean isCreate = registro.Id == null;
        if (isCreate) {
            assertCreateable(RegistroRepositorio__c.SObjectType, 'Registro Repositório');
        } else {
            assertUpdateable(RegistroRepositorio__c.SObjectType, 'Registro Repositório');
        }

        RegistroRepositorio__c registroParaSalvar = buildRegistroForDml(registro);
        List<SObject> allowedRecords = isCreate
            ? stripForCreate(new List<SObject>{ registroParaSalvar })
            : stripForUpdate(new List<SObject>{ registroParaSalvar });

        registroParaSalvar = (RegistroRepositorio__c) allowedRecords[0];
        if (isCreate) {
            insert registroParaSalvar;
        } else {
            update registroParaSalvar;
        }
        return getRegistroById(registroParaSalvar.Id);
    }

    @AuraEnabled
    public static void arquivarRegistro(Id registroId) {
        requireId(registroId, 'Registro');
        assertUpdateable(RegistroRepositorio__c.SObjectType, 'Registro Repositório');
        if (!Schema.sObjectType.RegistroRepositorio__c.fields.Status__c.isUpdateable()) {
            throw new AuraHandledException('Sem permissão para arquivar registros.');
        }

        RegistroRepositorio__c registro = new RegistroRepositorio__c(
            Id = registroId,
            Status__c = STATUS_ARQUIVADO
        );
        update registro;
    }

    private static RegistroRepositorio__c buildRegistroForDml(RegistroRepositorio__c source) {
        return new RegistroRepositorio__c(
            Id = source.Id,
            Name = source.Name != null ? source.Name.trim() : null,
            Cliente__c = source.Cliente__c,
            Projeto__c = source.Projeto__c,
            Tipo__c = source.Tipo__c,
            Status__c = source.Status__c,
            Resumo__c = source.Resumo__c,
            Conteudo__c = source.Conteudo__c,
            Criticidade__c = source.Criticidade__c,
            Risco__c = source.Risco__c,
            Ambiente__c = source.Ambiente__c,
            Tags__c = source.Tags__c,
            ObjetoSalesforce__c = source.ObjetoSalesforce__c,
            ClasseOuFlow__c = source.ClasseOuFlow__c,
            Ordem__c = source.Ordem__c,
            Sintoma__c = source.Sintoma__c,
            CausaProvavel__c = source.CausaProvavel__c,
            ComoInvestigar__c = source.ComoInvestigar__c,
            ComoResolver__c = source.ComoResolver__c,
            ComoValidar__c = source.ComoValidar__c,
            QuandoUsar__c = source.QuandoUsar__c,
            Parametros__c = source.Parametros__c,
            QuerySOQL__c = source.QuerySOQL__c,
            ComoInterpretar__c = source.ComoInterpretar__c,
            Objetivo__c = source.Objetivo__c,
            ExigeBackup__c = source.ExigeBackup__c,
            ExigeAprovacao__c = source.ExigeAprovacao__c,
            ScriptApex__c = source.ScriptApex__c,
            Rollback__c = source.Rollback__c,
            MensagemErro__c = source.MensagemErro__c,
            OndeAcontece__c = source.OndeAcontece__c,
            SolucaoConhecida__c = source.SolucaoConhecida__c,
            PreRequisitos__c = source.PreRequisitos__c,
            Passos__c = source.Passos__c,
            Cuidados__c = source.Cuidados__c,
            ResultadoEsperado__c = source.ResultadoEsperado__c
        );
    }

    private static void validarRegistro(RegistroRepositorio__c registro) {
        requireText(registro.Name, 'Título');
        requireId(registro.Cliente__c, 'Cliente');
        requireId(registro.Projeto__c, 'Projeto');
        requireText(registro.Tipo__c, 'Tipo');
        requireText(registro.Status__c, 'Status');

        switch on registro.Tipo__c {
            when 'Caso recorrente' {
                requireText(registro.Sintoma__c, 'Sintoma');
                requireText(registro.ComoInvestigar__c, 'Como investigar');
                requireText(registro.ComoResolver__c, 'Como resolver');
            }
            when 'Query SOQL' {
                requireText(registro.QuandoUsar__c, 'Quando usar');
                requireText(registro.QuerySOQL__c, 'Query SOQL');
            }
            when 'Script Anonymous Apex' {
                requireText(registro.Objetivo__c, 'Objetivo');
                requireText(registro.ScriptApex__c, 'Script Apex');
                requireText(registro.Risco__c, 'Risco');
                requireText(registro.Ambiente__c, 'Ambiente');
            }
            when 'Erro conhecido' {
                requireText(registro.MensagemErro__c, 'Mensagem do erro');
                requireText(registro.SolucaoConhecida__c, 'Solução conhecida');
            }
            when 'Procedimento' {
                requireText(registro.Objetivo__c, 'Objetivo');
                requireText(registro.Passos__c, 'Passos');
            }
            when else {
                throw new AuraHandledException('Tipo de registro inválido.');
            }
        }
    }

    private static ClienteRepositorio__c getClienteById(Id clienteId) {
        List<ClienteRepositorio__c> clientes = [
            SELECT Id, Name, Ativo__c, Descricao__c, Observacoes__c
            FROM ClienteRepositorio__c
            WHERE Id = :clienteId
            LIMIT 1
        ];
        return stripClientes(clientes)[0];
    }

    private static ProjetoRepositorio__c getProjetoById(Id projetoId) {
        List<ProjetoRepositorio__c> projetos = [
            SELECT Id, Name, Cliente__c, Cliente__r.Name, Ativo__c, Descricao__c
            FROM ProjetoRepositorio__c
            WHERE Id = :projetoId
            LIMIT 1
        ];
        return stripProjetos(projetos)[0];
    }

    private static RegistroRepositorio__c getRegistroById(Id registroId) {
        List<RegistroRepositorio__c> registros = [
            SELECT
                Id,
                Name,
                Cliente__c,
                Cliente__r.Name,
                Projeto__c,
                Projeto__r.Name,
                Tipo__c,
                Status__c,
                Resumo__c,
                Conteudo__c,
                Criticidade__c,
                Risco__c,
                Ambiente__c,
                Tags__c,
                ObjetoSalesforce__c,
                ClasseOuFlow__c,
                Ordem__c,
                Sintoma__c,
                CausaProvavel__c,
                ComoInvestigar__c,
                ComoResolver__c,
                ComoValidar__c,
                QuandoUsar__c,
                Parametros__c,
                QuerySOQL__c,
                ComoInterpretar__c,
                Objetivo__c,
                ExigeBackup__c,
                ExigeAprovacao__c,
                ScriptApex__c,
                Rollback__c,
                MensagemErro__c,
                OndeAcontece__c,
                SolucaoConhecida__c,
                PreRequisitos__c,
                Passos__c,
                Cuidados__c,
                ResultadoEsperado__c,
                LastModifiedDate
            FROM RegistroRepositorio__c
            WHERE Id = :registroId
            LIMIT 1
        ];
        return stripRegistros(registros)[0];
    }

    private static void requireId(Id value, String label) {
        if (value == null) {
            throw new AuraHandledException(label + ' é obrigatório.');
        }
    }

    private static void requireText(String value, String label) {
        if (String.isBlank(value)) {
            throw new AuraHandledException(label + ' é obrigatório.');
        }
    }

    private static void assertReadable(Schema.SObjectType objectType, String label) {
        if (!objectType.getDescribe().isAccessible()) {
            throw new AuraHandledException('Sem permissão de leitura para ' + label + '.');
        }
    }

    private static void assertCreateable(Schema.SObjectType objectType, String label) {
        if (!objectType.getDescribe().isCreateable()) {
            throw new AuraHandledException('Sem permissão de criação para ' + label + '.');
        }
    }

    private static void assertUpdateable(Schema.SObjectType objectType, String label) {
        if (!objectType.getDescribe().isUpdateable()) {
            throw new AuraHandledException('Sem permissão de edição para ' + label + '.');
        }
    }

    private static List<SObject> stripForCreate(List<SObject> records) {
        return records;
    }

    private static List<SObject> stripForUpdate(List<SObject> records) {
        return records;
    }

    private static List<ClienteRepositorio__c> stripClientes(List<ClienteRepositorio__c> records) {
        return records;
    }

    private static List<ProjetoRepositorio__c> stripProjetos(List<ProjetoRepositorio__c> records) {
        return records;
    }

    private static List<RegistroRepositorio__c> stripRegistros(List<RegistroRepositorio__c> records) {
        return records;
    }
}
