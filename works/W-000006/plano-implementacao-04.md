# Plano de implementacao 04

## Informacoes da execucao

- IA/agente usado: Codex
- Nivel/configuracao: Default
- Data de inicio: 2026-09-05

## Objetivo

Disponibilizar o comunicador tambem nas telas de Critério de Aceite e Cenário de Teste.

## Etapas

- [x] Permitir que o LWC workCommunicator seja usado em CriterioAceite__c e CenarioTeste__c.
- [x] Resolver o contexto da demanda a partir do Critério ou Cenário aberto.
- [x] Criar record pages Lightning para os dois objetos.
- [x] Ativar as record pages por override de visualizacao nos objetos.
- [x] Validar testes e publicar na dev-org.

## Resultado

- O comunicador pode ser usado em Case, Work, Critério de Aceite e Cenário de Teste.
- Quando aberto a partir de um Critério ou Cenário, o controller encontra a Work relacionada e carrega a mesma hierarquia da demanda.
- Publicacoes podem ser feitas diretamente no feed do Critério ou Cenário.
- As mensagens desses registros tambem aparecem no feed consolidado da demanda.

## Validacao realizada

- Validate granular 0AfgL00000WlrpdSAB: Succeeded.
- RunSpecifiedTests com WorkCommunicationControllerTest: 8 testes, zero falhas.
- Deploy publicado por quick deploy 0AfgL00000WlrsrSAB: Succeeded.

## Observacoes

- O deploy dos arquivos de objeto levou junto campos/list views filhos como Unchanged, comportamento normal quando o source-dir aponta para o metadata do objeto.
- Nao foi executada inspecao visual em navegador nesta etapa.
