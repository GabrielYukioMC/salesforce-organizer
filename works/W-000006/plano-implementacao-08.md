# Plano de implementacao 08

## Informacoes da execucao

- IA/agente usado: Codex
- Nivel/configuracao: Default
- Data de inicio: 2026-09-05

## Objetivo

Fazer os arquivos anexados em respostas aparecerem visualmente nos comentarios do comunicador.

## Etapas

- [x] Alterar getComments para devolver comentarios em formato estruturado.
- [x] Incluir metadados do arquivo relacionado ao comentario.
- [x] Renderizar anexos dentro das respostas no feed simples e na aba Mensagens estruturadas.
- [x] Reabrir o bloco de comentarios depois de enviar uma resposta.
- [x] Validar e publicar na dev-org.

## Resultado

- Arquivos anexados ao responder passam a aparecer no comentario como card/preview.
- Imagens usam miniatura e outros arquivos usam icone, titulo, extensao, tamanho e link de abertura.
- Depois do envio da resposta, o card continua aberto e recarrega os comentarios.

## Validacao realizada

- Validate granular 0AfgL00000WoeeASAR: Succeeded.
- RunSpecifiedTests com WorkCommunicationControllerTest: 9 testes, zero falhas.
- Deploy publicado por quick deploy 0AfgL00000WoghZSAR: Succeeded.
- git diff --check nos arquivos alterados: sem erros.

## Observacoes

- O arquivo de resposta usa RelatedRecordId do FeedComment para expor o anexo de forma estruturada.
- Links dos arquivos continuam no corpo do comentario como fallback visivel.
- Nao foi executada inspecao visual em navegador nesta etapa.
