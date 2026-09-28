# Plano de implementacao 07

## Informacoes da execucao

- IA/agente usado: Codex
- Nivel/configuracao: Default
- Data de inicio: 2026-09-05

## Objetivo

Permitir anexar arquivos em respostas do comunicador e corrigir a exibicao do saldo util de SLA.

## Etapas

- [x] Adicionar upload de arquivo no bloco de resposta dos comentarios.
- [x] Enviar os arquivos escolhidos junto da resposta.
- [x] Ajustar o controller para aceitar arquivos em comentarios sem usar FeedAttachment em FeedComment, que falhou na org.
- [x] Trocar o saldo do comunicador para o mesmo calculo em tempo real usado pelo monitor de SLA.
- [x] Conceder acesso ao CaseSLAStatusController no permission set Gestao_Works.
- [x] Validar e publicar na dev-org.

## Resultado

- O usuario pode anexar arquivos ao responder um comentario no feed simples e na aba Mensagens estruturadas.
- A resposta grava o primeiro arquivo como RelatedRecordId do FeedComment e tambem inclui os links dos arquivos no corpo do comentario.
- O saldo deixou de usar o campo persistido SLATempoRestanteUtilHoras__c e passou a usar CaseSLAStatusController.getStatus.
- A exibicao passou para formato humano, como 15h 50min restantes ou 2h vencido.

## Validacao realizada

- Validate granular 0AfgL00000Wog1dSAB: Succeeded.
- RunSpecifiedTests com WorkCommunicationControllerTest: 9 testes, zero falhas.
- Deploy publicado por quick deploy 0AfgL00000Wog3FSAR: Succeeded.
- git diff --check nos arquivos alterados: sem erros.

## Observacoes

- Tentativa com FeedAttachment ligado diretamente ao FeedComment falhou com UNKNOWN_EXCEPTION unexpected metadata na org. A alternativa publicada usa RelatedRecordId e links no comentario.
- O upload continua vinculando o arquivo ao registro pai do post para manter acesso ao arquivo no contexto da conversa.
- Nao foi executada inspecao visual em navegador nesta etapa.
