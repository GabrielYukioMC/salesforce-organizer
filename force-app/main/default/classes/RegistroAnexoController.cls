public without sharing class RegistroAnexoController {
    private static final Integer MAX_ANEXOS_POR_REGISTRO = 3;
    @TestVisible
    private static Long maxTamanhoArquivoBytes = 2 * 1024 * 1024;
    private static final Set<String> EXTENSOES_BLOQUEADAS = new Set<String>{
        'exe', 'bat', 'cmd', 'sh', 'msi', 'dll', 'com', 'scr', 'jar', 'ps1', 'vbs', 'app'
    };

    @AuraEnabled
    public static List<AnexoWrapper> getAnexos(Id registroId) {
        requireId(registroId, 'Registro');
        assertReadable(ContentDocument.SObjectType, 'Anexo');

        Set<Id> docIds = documentIdsDoRegistro(registroId);
        if (docIds.isEmpty()) {
            return new List<AnexoWrapper>();
        }

        List<ContentDocument> documentos = [
            SELECT Id, Title, FileExtension, ContentSize, CreatedDate
            FROM ContentDocument
            WHERE Id IN :docIds
            ORDER BY CreatedDate DESC
        ];
        return toWrappers(documentos);
    }

    @AuraEnabled
    public static AnexoWrapper uploadAnexo(Id registroId, String fileName, String base64Data) {
        requireId(registroId, 'Registro');
        requireText(fileName, 'Nome do arquivo');
        requireText(base64Data, 'Conteúdo do arquivo');
        assertCreateable(ContentVersion.SObjectType, 'Anexo');
        assertExtensaoPermitida(fileName);
        assertLimiteDeAnexos(registroId);

        Blob conteudo = decodeBase64Seguro(base64Data);
        assertTamanhoPermitido(conteudo);

        ContentVersion versao = new ContentVersion(
            Title = tituloSemExtensao(fileName),
            PathOnClient = fileName,
            VersionData = conteudo,
            FirstPublishLocationId = registroId
        );
        try {
            insert versao;
        } catch (DmlException e) {
            throw new AuraHandledException('Não foi possível anexar o arquivo. Verifique se o registro existe.');
        }

        return toWrapper(getContentDocumentIdDaVersao(versao.Id));
    }

    @AuraEnabled
    public static void excluirAnexo(Id registroId, Id contentDocumentId) {
        requireId(registroId, 'Registro');
        requireId(contentDocumentId, 'Anexo');
        assertDeletable(ContentDocument.SObjectType, 'Anexo');
        assertAnexoPertenceAoRegistro(registroId, contentDocumentId);

        try {
            delete new ContentDocument(Id = contentDocumentId);
        } catch (DmlException e) {
            throw new AuraHandledException('Não foi possível remover o anexo.');
        }
    }

    private static Set<Id> documentIdsDoRegistro(Id registroId) {
        Set<Id> docIds = new Set<Id>();
        for (ContentDocumentLink link : [
            SELECT ContentDocumentId
            FROM ContentDocumentLink
            WHERE LinkedEntityId = :registroId
        ]) {
            docIds.add(link.ContentDocumentId);
        }
        return docIds;
    }

    private static void assertLimiteDeAnexos(Id registroId) {
        Integer total = [SELECT COUNT() FROM ContentDocumentLink WHERE LinkedEntityId = :registroId];
        if (total >= MAX_ANEXOS_POR_REGISTRO) {
            throw new AuraHandledException('Este registro já atingiu o limite de ' + MAX_ANEXOS_POR_REGISTRO + ' anexos.');
        }
    }

    private static void assertExtensaoPermitida(String fileName) {
        String extensao = extensaoDoArquivo(fileName);
        if (String.isNotBlank(extensao) && EXTENSOES_BLOQUEADAS.contains(extensao)) {
            throw new AuraHandledException('Tipo de arquivo não permitido: .' + extensao);
        }
    }

    private static String extensaoDoArquivo(String fileName) {
        Integer lastDot = fileName.lastIndexOf('.');
        if (lastDot < 0 || lastDot == fileName.length() - 1) {
            return '';
        }
        return fileName.substring(lastDot + 1).toLowerCase();
    }

    private static String tituloSemExtensao(String fileName) {
        Integer lastDot = fileName.lastIndexOf('.');
        return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
    }

    private static Blob decodeBase64Seguro(String base64Data) {
        try {
            return EncodingUtil.base64Decode(base64Data);
        } catch (Exception e) {
            throw new AuraHandledException('Arquivo inválido ou corrompido.');
        }
    }

    private static void assertTamanhoPermitido(Blob conteudo) {
        if (conteudo.size() > maxTamanhoArquivoBytes) {
            throw new AuraHandledException('O arquivo excede o tamanho máximo permitido de ' + (maxTamanhoArquivoBytes / (1024 * 1024)) + 'MB.');
        }
    }

    private static void assertAnexoPertenceAoRegistro(Id registroId, Id contentDocumentId) {
        List<ContentDocumentLink> links = [
            SELECT Id
            FROM ContentDocumentLink
            WHERE LinkedEntityId = :registroId AND ContentDocumentId = :contentDocumentId
            LIMIT 1
        ];
        if (links.isEmpty()) {
            throw new AuraHandledException('Anexo não encontrado para este registro.');
        }
    }

    private static Id getContentDocumentIdDaVersao(Id versaoId) {
        ContentVersion versao = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :versaoId LIMIT 1];
        return versao.ContentDocumentId;
    }

    private static AnexoWrapper toWrapper(Id contentDocumentId) {
        List<ContentDocument> documentos = [
            SELECT Id, Title, FileExtension, ContentSize, CreatedDate
            FROM ContentDocument
            WHERE Id = :contentDocumentId
            LIMIT 1
        ];
        return toWrappers(documentos)[0];
    }

    private static List<AnexoWrapper> toWrappers(List<ContentDocument> documentos) {
        List<AnexoWrapper> wrappers = new List<AnexoWrapper>();
        for (ContentDocument documento : documentos) {
            AnexoWrapper wrapper = new AnexoWrapper();
            wrapper.contentDocumentId = documento.Id;
            wrapper.title = documento.Title;
            wrapper.fileExtension = documento.FileExtension;
            wrapper.contentSize = documento.ContentSize;
            wrapper.createdDate = documento.CreatedDate;
            wrappers.add(wrapper);
        }
        return wrappers;
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

    private static void assertDeletable(Schema.SObjectType objectType, String label) {
        if (!objectType.getDescribe().isDeletable()) {
            throw new AuraHandledException('Sem permissão de exclusão para ' + label + '.');
        }
    }

    public class AnexoWrapper {
        @AuraEnabled
        public Id contentDocumentId;
        @AuraEnabled
        public String title;
        @AuraEnabled
        public String fileExtension;
        @AuraEnabled
        public Integer contentSize;
        @AuraEnabled
        public Datetime createdDate;
    }
}
