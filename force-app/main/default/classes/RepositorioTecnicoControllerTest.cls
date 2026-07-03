@IsTest
private class RepositorioTecnicoControllerTest {
    @IsTest
    static void deveCriarClienteProjetoEFiltrarRegistros() {
        ClienteRepositorio__c cliente = RepositorioTecnicoController.criarCliente(
            new ClienteRepositorio__c(Name = 'EMCCAMP', Descricao__c = 'Cliente de sustentação', Ativo__c = true)
        );

        List<ClienteRepositorio__c> clientes = RepositorioTecnicoController.getClientes();
        System.assertEquals(1, clientes.size(), 'Deve retornar somente clientes ativos.');
        System.assertEquals(cliente.Id, clientes[0].Id);

        ProjetoRepositorio__c projeto = RepositorioTecnicoController.criarProjeto(
            new ProjetoRepositorio__c(Name = 'Sustentação', Cliente__c = cliente.Id, Ativo__c = true)
        );

        List<ProjetoRepositorio__c> projetos = RepositorioTecnicoController.getProjetosByCliente(cliente.Id);
        System.assertEquals(1, projetos.size(), 'Deve retornar projetos do cliente.');
        System.assertEquals(projeto.Id, projetos[0].Id);

        RegistroRepositorio__c caso = salvarCaso(cliente.Id, projeto.Id);
        RegistroRepositorio__c query = salvarQuery(cliente.Id, projeto.Id);
        RegistroRepositorio__c script = salvarScript(cliente.Id, projeto.Id);
        RegistroRepositorio__c erro = salvarErro(cliente.Id, projeto.Id);
        RegistroRepositorio__c procedimento = salvarProcedimento(cliente.Id, projeto.Id);

        System.assertNotEquals(null, caso.Id);
        System.assertNotEquals(null, query.Id);
        System.assertNotEquals(null, script.Id);
        System.assertNotEquals(null, erro.Id);
        System.assertNotEquals(null, procedimento.Id);

        List<RegistroRepositorio__c> queries = RepositorioTecnicoController.getRegistros(
            cliente.Id,
            projeto.Id,
            'Query SOQL'
        );
        System.assertEquals(1, queries.size(), 'Deve filtrar por tipo.');
        System.assertEquals(query.Id, queries[0].Id);

        query.QuandoUsar__c = 'Quando for necessário localizar um lead por telefone.';
        RegistroRepositorio__c queryAtualizada = RepositorioTecnicoController.salvarRegistro(query);
        System.assertEquals(query.Id, queryAtualizada.Id, 'Deve atualizar registro existente.');
        System.assertEquals(
            'Quando for necessário localizar um lead por telefone.',
            queryAtualizada.QuandoUsar__c
        );

        RepositorioTecnicoController.arquivarRegistro(query.Id);
        List<RegistroRepositorio__c> queriesDepoisArquivo = RepositorioTecnicoController.getRegistros(
            cliente.Id,
            projeto.Id,
            'Query SOQL'
        );
        System.assertEquals(0, queriesDepoisArquivo.size(), 'Arquivados não devem aparecer na busca principal.');
    }

    @IsTest
    static void deveIgnorarClienteEProjetoInativos() {
        ClienteRepositorio__c ativo = RepositorioTecnicoController.criarCliente(
            new ClienteRepositorio__c(Name = 'PLANO CAPITAL', Ativo__c = true)
        );
        RepositorioTecnicoController.criarCliente(new ClienteRepositorio__c(Name = 'INATIVO', Ativo__c = false));
        RepositorioTecnicoController.criarProjeto(
            new ProjetoRepositorio__c(Name = 'Oferta Ativa', Cliente__c = ativo.Id, Ativo__c = true)
        );
        RepositorioTecnicoController.criarProjeto(
            new ProjetoRepositorio__c(Name = 'Projeto Inativo', Cliente__c = ativo.Id, Ativo__c = false)
        );

        System.assertEquals(1, RepositorioTecnicoController.getClientes().size());
        System.assertEquals(1, RepositorioTecnicoController.getProjetosByCliente(ativo.Id).size());
    }

    @IsTest
    static void deveListarRegistrosDeTodosClientesAtivos() {
        ClienteRepositorio__c clienteA = RepositorioTecnicoController.criarCliente(
            new ClienteRepositorio__c(Name = 'Cliente A', Ativo__c = true)
        );
        ProjetoRepositorio__c projetoA = RepositorioTecnicoController.criarProjeto(
            new ProjetoRepositorio__c(Name = 'Projeto A', Cliente__c = clienteA.Id, Ativo__c = true)
        );
        RegistroRepositorio__c scriptA = salvarScript(clienteA.Id, projetoA.Id);

        ClienteRepositorio__c clienteB = RepositorioTecnicoController.criarCliente(
            new ClienteRepositorio__c(Name = 'Cliente B', Ativo__c = true)
        );
        ProjetoRepositorio__c projetoB = RepositorioTecnicoController.criarProjeto(
            new ProjetoRepositorio__c(Name = 'Projeto B', Cliente__c = clienteB.Id, Ativo__c = true)
        );
        RegistroRepositorio__c scriptB = salvarScript(clienteB.Id, projetoB.Id);

        ClienteRepositorio__c clienteInativo = RepositorioTecnicoController.criarCliente(
            new ClienteRepositorio__c(Name = 'Cliente Inativo', Ativo__c = false)
        );
        ProjetoRepositorio__c projetoClienteInativo = RepositorioTecnicoController.criarProjeto(
            new ProjetoRepositorio__c(Name = 'Projeto Cliente Inativo', Cliente__c = clienteInativo.Id, Ativo__c = true)
        );
        salvarScript(clienteInativo.Id, projetoClienteInativo.Id);

        ProjetoRepositorio__c projetoInativo = RepositorioTecnicoController.criarProjeto(
            new ProjetoRepositorio__c(Name = 'Projeto Inativo', Cliente__c = clienteA.Id, Ativo__c = false)
        );
        salvarScript(clienteA.Id, projetoInativo.Id);

        List<RegistroRepositorio__c> scripts = RepositorioTecnicoController.getRegistrosTodos(
            'Script Anonymous Apex'
        );
        Set<Id> scriptIds = new Map<Id, RegistroRepositorio__c>(scripts).keySet();

        System.assertEquals(2, scripts.size(), 'Deve retornar registros de todos os clientes/projetos ativos.');
        System.assert(scriptIds.contains(scriptA.Id), 'Deve incluir o registro do cliente A.');
        System.assert(scriptIds.contains(scriptB.Id), 'Deve incluir o registro do cliente B.');

        RepositorioTecnicoController.arquivarRegistro(scriptA.Id);
        List<RegistroRepositorio__c> scriptsDepoisArquivo = RepositorioTecnicoController.getRegistrosTodos(
            'Script Anonymous Apex'
        );
        System.assertEquals(1, scriptsDepoisArquivo.size(), 'Arquivados não devem aparecer na visão Todos.');
        System.assertEquals(scriptB.Id, scriptsDepoisArquivo[0].Id);
    }

    @IsTest
    static void deveValidarParametrosObrigatorios() {
        assertAuraErrorOnCliente();
        assertAuraErrorOnProjeto();
        assertAuraErrorOnBuscaProjeto();
        assertAuraErrorOnBuscaRegistro();
        assertAuraErrorOnBuscaTodos();
        assertAuraErrorOnRegistroInvalido();
        assertAuraErrorOnArquivo();
    }

    private static RegistroRepositorio__c salvarCaso(Id clienteId, Id projetoId) {
        return RepositorioTecnicoController.salvarRegistro(
            new RegistroRepositorio__c(
                Name = 'Lead não distribuído após horário comercial',
                Cliente__c = clienteId,
                Projeto__c = projetoId,
                Tipo__c = 'Caso recorrente',
                Status__c = 'Ativo',
                Resumo__c = 'Lead fica parado na fila.',
                Sintoma__c = 'Lead fica parado na fila e não é distribuído.',
                ComoInvestigar__c = 'Verificar fila, owner e carga dos usuários.',
                ComoResolver__c = 'Ajustar disponibilidade ou regra de distribuição.',
                ComoValidar__c = 'Lead distribuído corretamente.'
            )
        );
    }

    private static RegistroRepositorio__c salvarQuery(Id clienteId, Id projetoId) {
        return RepositorioTecnicoController.salvarRegistro(
            new RegistroRepositorio__c(
                Name = 'Buscar lead por telefone',
                Cliente__c = clienteId,
                Projeto__c = projetoId,
                Tipo__c = 'Query SOQL',
                Status__c = 'Ativo',
                QuandoUsar__c = 'Quando preciso localizar um lead.',
                ObjetoSalesforce__c = 'Lead',
                QuerySOQL__c = 'SELECT Id, Name FROM Lead'
            )
        );
    }

    private static RegistroRepositorio__c salvarScript(Id clienteId, Id projetoId) {
        return RepositorioTecnicoController.salvarRegistro(
            new RegistroRepositorio__c(
                Name = 'Reprocessar leads parados na fila',
                Cliente__c = clienteId,
                Projeto__c = projetoId,
                Tipo__c = 'Script Anonymous Apex',
                Status__c = 'Ativo',
                Objetivo__c = 'Atualizar leads parados na fila.',
                ScriptApex__c = 'List<Lead> leads = new List<Lead>();',
                Risco__c = 'Alto',
                Ambiente__c = 'PROD',
                ExigeBackup__c = true,
                ExigeAprovacao__c = true
            )
        );
    }

    private static RegistroRepositorio__c salvarErro(Id clienteId, Id projetoId) {
        return RepositorioTecnicoController.salvarRegistro(
            new RegistroRepositorio__c(
                Name = 'INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY em Repasse',
                Cliente__c = clienteId,
                Projeto__c = projetoId,
                Tipo__c = 'Erro conhecido',
                Status__c = 'Ativo',
                MensagemErro__c = 'INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY',
                OndeAcontece__c = 'Ao criar ou atualizar registros de Repasse.',
                SolucaoConhecida__c = 'Validar owner, sharing e permissões.'
            )
        );
    }

    private static RegistroRepositorio__c salvarProcedimento(Id clienteId, Id projetoId) {
        return RepositorioTecnicoController.salvarRegistro(
            new RegistroRepositorio__c(
                Name = 'Procedimento de validate para PR Salesforce',
                Cliente__c = clienteId,
                Projeto__c = projetoId,
                Tipo__c = 'Procedimento',
                Status__c = 'Ativo',
                Objetivo__c = 'Garantir que a PR esteja validada corretamente.',
                Passos__c = 'Preparar escopo, rodar validate e verificar cobertura.'
            )
        );
    }

    private static void assertAuraErrorOnCliente() {
        try {
            RepositorioTecnicoController.criarCliente(new ClienteRepositorio__c());
            System.assert(false, 'Cliente sem nome deveria falhar.');
        } catch (AuraHandledException expected) {
            System.assertNotEquals(null, expected);
        }
    }

    private static void assertAuraErrorOnProjeto() {
        try {
            RepositorioTecnicoController.criarProjeto(new ProjetoRepositorio__c(Name = 'Sem Cliente'));
            System.assert(false, 'Projeto sem cliente deveria falhar.');
        } catch (AuraHandledException expected) {
            System.assertNotEquals(null, expected);
        }
    }

    private static void assertAuraErrorOnBuscaProjeto() {
        try {
            RepositorioTecnicoController.getProjetosByCliente(null);
            System.assert(false, 'Busca sem cliente deveria falhar.');
        } catch (AuraHandledException expected) {
            System.assertNotEquals(null, expected);
        }
    }

    private static void assertAuraErrorOnBuscaRegistro() {
        try {
            RepositorioTecnicoController.getRegistros(null, null, null);
            System.assert(false, 'Busca sem filtros obrigatórios deveria falhar.');
        } catch (AuraHandledException expected) {
            System.assertNotEquals(null, expected);
        }
    }

    private static void assertAuraErrorOnBuscaTodos() {
        try {
            RepositorioTecnicoController.getRegistrosTodos(null);
            System.assert(false, 'Busca todos sem tipo deveria falhar.');
        } catch (AuraHandledException expected) {
            System.assertNotEquals(null, expected);
        }
    }

    private static void assertAuraErrorOnRegistroInvalido() {
        try {
            RepositorioTecnicoController.salvarRegistro(new RegistroRepositorio__c(Name = 'Inválido'));
            System.assert(false, 'Registro incompleto deveria falhar.');
        } catch (AuraHandledException expected) {
            System.assertNotEquals(null, expected);
        }
    }

    private static void assertAuraErrorOnArquivo() {
        try {
            RepositorioTecnicoController.arquivarRegistro(null);
            System.assert(false, 'Arquivo sem Id deveria falhar.');
        } catch (AuraHandledException expected) {
            System.assertNotEquals(null, expected);
        }
    }
}
