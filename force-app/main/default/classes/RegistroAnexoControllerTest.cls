@IsTest
private class RegistroAnexoControllerTest {
    @IsTest
    static void deveGerenciarCicloDeVidaDoAnexo() {
        RegistroRepositorio__c registro = salvarRegistro();

        RegistroAnexoController.AnexoWrapper anexo = RegistroAnexoController.uploadAnexo(
            registro.Id,
            'print-erro.png',
            base64De('conteúdo de teste do anexo')
        );
        System.assertNotEquals(null, anexo.contentDocumentId, 'Upload deveria retornar o anexo criado.');
        System.assertEquals('png', anexo.fileExtension);

        List<RegistroAnexoController.AnexoWrapper> anexos = RegistroAnexoController.getAnexos(registro.Id);
        System.assertEquals(1, anexos.size(), 'Deveria listar o anexo recém-criado.');
        System.assertEquals(anexo.contentDocumentId, anexos[0].contentDocumentId);

        RegistroAnexoController.excluirAnexo(registro.Id, anexo.contentDocumentId);
        System.assertEquals(0, RegistroAnexoController.getAnexos(registro.Id).size(), 'Anexo removido não deveria mais aparecer.');
    }

    @IsTest
    static void deveBloquearMaisDeTresAnexos() {
        RegistroRepositorio__c registro = salvarRegistro();

        RegistroAnexoController.uploadAnexo(registro.Id, 'arquivo-1.txt', base64De('conteudo 1'));
        RegistroAnexoController.uploadAnexo(registro.Id, 'arquivo-2.txt', base64De('conteudo 2'));
        RegistroAnexoController.uploadAnexo(registro.Id, 'arquivo-3.txt', base64De('conteudo 3'));
        System.assertEquals(3, RegistroAnexoController.getAnexos(registro.Id).size());

        try {
            RegistroAnexoController.uploadAnexo(registro.Id, 'arquivo-4.txt', base64De('conteudo 4'));
            System.assert(false, 'Quarto anexo deveria falhar pelo limite de 3.');
        } catch (AuraHandledException expected) {
            System.assertNotEquals(null, expected);
        }
        System.assertEquals(3, RegistroAnexoController.getAnexos(registro.Id).size(), 'Limite deve permanecer em 3.');
    }

    @IsTest
    static void deveBloquearArquivoMuitoGrandeEExtensaoPerigosa() {
        RegistroRepositorio__c registro = salvarRegistro();
        RegistroAnexoController.maxTamanhoArquivoBytes = 1000;

        try {
            RegistroAnexoController.uploadAnexo(registro.Id, 'arquivo-grande.txt', base64De('x'.repeat(1001)));
            System.assert(false, 'Arquivo acima do limite de tamanho deveria falhar.');
        } catch (AuraHandledException expected) {
            System.assertNotEquals(null, expected);
        }

        try {
            RegistroAnexoController.uploadAnexo(registro.Id, 'script.exe', base64De('conteudo'));
            System.assert(false, 'Extensão bloqueada deveria falhar.');
        } catch (AuraHandledException expected) {
            System.assertNotEquals(null, expected);
        }

        System.assertEquals(0, RegistroAnexoController.getAnexos(registro.Id).size(), 'Nenhum anexo inválido deveria ter sido criado.');
    }

    @IsTest
    static void deveBloquearRemocaoDeAnexoDeOutroRegistro() {
        RegistroRepositorio__c registroA = salvarRegistro();
        RegistroRepositorio__c registroB = salvarRegistro();

        RegistroAnexoController.AnexoWrapper anexoDeA = RegistroAnexoController.uploadAnexo(
            registroA.Id,
            'arquivo-a.txt',
            base64De('conteudo do registro A')
        );

        try {
            RegistroAnexoController.excluirAnexo(registroB.Id, anexoDeA.contentDocumentId);
            System.assert(false, 'Excluir anexo de outro registro deveria falhar.');
        } catch (AuraHandledException expected) {
            System.assertNotEquals(null, expected);
        }
        System.assertEquals(1, RegistroAnexoController.getAnexos(registroA.Id).size(), 'Anexo do registro A não deveria ter sido removido.');
    }

    @IsTest
    static void deveValidarParametrosObrigatorios() {
        assertAuraErrorOnGetAnexosSemId();
        assertAuraErrorOnUploadSemRegistro();
        assertAuraErrorOnUploadSemNomeArquivo();
        assertAuraErrorOnUploadSemConteudo();
        assertAuraErrorOnExcluirSemRegistro();
        assertAuraErrorOnExcluirSemAnexo();
    }

    private static RegistroRepositorio__c salvarRegistro() {
        ClienteRepositorio__c cliente = RepositorioTecnicoController.criarCliente(
            new ClienteRepositorio__c(Name = 'EMCCAMP', Ativo__c = true)
        );
        ProjetoRepositorio__c projeto = RepositorioTecnicoController.criarProjeto(
            new ProjetoRepositorio__c(Name = 'Sustentação', Cliente__c = cliente.Id, Ativo__c = true)
        );
        return RepositorioTecnicoController.salvarRegistro(
            new RegistroRepositorio__c(
                Name = 'Buscar lead por telefone',
                Cliente__c = cliente.Id,
                Projeto__c = projeto.Id,
                Tipo__c = 'Query SOQL',
                Status__c = 'Ativo',
                QuandoUsar__c = 'Quando preciso localizar um lead.',
                ObjetoSalesforce__c = 'Lead',
                QuerySOQL__c = 'SELECT Id, Name FROM Lead'
            )
        );
    }

    private static String base64De(String conteudo) {
        return EncodingUtil.base64Encode(Blob.valueOf(conteudo));
    }

    private static void assertAuraErrorOnGetAnexosSemId() {
        try {
            RegistroAnexoController.getAnexos(null);
            System.assert(false, 'Busca sem Id do registro deveria falhar.');
        } catch (AuraHandledException expected) {
            System.assertNotEquals(null, expected);
        }
    }

    private static void assertAuraErrorOnUploadSemRegistro() {
        try {
            RegistroAnexoController.uploadAnexo(null, 'arquivo.txt', base64De('conteudo'));
            System.assert(false, 'Upload sem Id do registro deveria falhar.');
        } catch (AuraHandledException expected) {
            System.assertNotEquals(null, expected);
        }
    }

    private static void assertAuraErrorOnUploadSemNomeArquivo() {
        RegistroRepositorio__c registro = salvarRegistro();
        try {
            RegistroAnexoController.uploadAnexo(registro.Id, null, base64De('conteudo'));
            System.assert(false, 'Upload sem nome do arquivo deveria falhar.');
        } catch (AuraHandledException expected) {
            System.assertNotEquals(null, expected);
        }
    }

    private static void assertAuraErrorOnUploadSemConteudo() {
        RegistroRepositorio__c registro = salvarRegistro();
        try {
            RegistroAnexoController.uploadAnexo(registro.Id, 'arquivo.txt', null);
            System.assert(false, 'Upload sem conteúdo deveria falhar.');
        } catch (AuraHandledException expected) {
            System.assertNotEquals(null, expected);
        }
    }

    private static void assertAuraErrorOnExcluirSemRegistro() {
        try {
            RegistroAnexoController.excluirAnexo(null, null);
            System.assert(false, 'Excluir sem Id do registro deveria falhar.');
        } catch (AuraHandledException expected) {
            System.assertNotEquals(null, expected);
        }
    }

    private static void assertAuraErrorOnExcluirSemAnexo() {
        RegistroRepositorio__c registro = salvarRegistro();
        try {
            RegistroAnexoController.excluirAnexo(registro.Id, null);
            System.assert(false, 'Excluir sem Id do anexo deveria falhar.');
        } catch (AuraHandledException expected) {
            System.assertNotEquals(null, expected);
        }
    }
}
