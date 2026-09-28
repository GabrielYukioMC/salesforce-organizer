# W-000004 - Controle de SLA de Cases

## Objetivo

Controlar SLA no objeto padrão `Case` com prioridade própria de P0 a P4, dois relógios independentes e cálculo respeitando Business Hours de suporte.

## Regras

| Prioridade | Atendimento | Trabalho |
| ---------- | ----------- | -------- |
| P0         | 2h úteis    | 8h úteis |
| P1         | 2h úteis    | 16h úteis |
| P2         | 2h úteis    | 24h úteis |
| P3         | 2h úteis    | 32h úteis |
| P4         | 2h úteis    | 40h úteis |

Business Hours:

- `SLA Suporte 9x18`
- Segunda a sexta
- 09:00 as 18:00
- Timezone `America/Sao_Paulo`
- Sábado, domingo e feriados não consomem SLA

## Solução implementada no repo

1. Campos customizados em `Case`
   - `PrioridadeSLA__c`
   - `SLAAtendimentoHoras__c`
   - `SLATrabalhoHoras__c`
   - `PrimeiroAtendimentoEm__c`
   - `InicioTrabalhoSLA__c`
   - `FimTrabalhoSLA__c`
   - `SLAAtendimentoPrazo__c`
   - `SLATrabalhoPrazo__c`
   - `InicioPausaSLA__c`
   - `SLAAtendimentoViolado__c`
   - `SLATrabalhoViolado__c`
   - `SLAFase__c`
   - `SLAStatus__c`

2. Automação Apex
   - `CaseSLATrigger`
   - `CaseSLATriggerHandler`

3. Validação
   - `BloquearAlteracaoPrioridadeSLA`
   - Custom Permission `AlterarPrioridadeSLA`
   - Permission Set `Alterar Prioridade SLA`

4. Layout
   - Seção `Controle de SLA` nos layouts padrão, Support, Sales e Marketing de Case.

## Comportamento

- Ao criar o Case, o prazo de atendimento é calculado com `BusinessHours.add`.
- Ao entrar em `Working` ou `Em Trabalho`, a automação preenche primeiro atendimento, início do trabalho e prazo de trabalho.
- Ao entrar em `Aguardando Cliente` ou `Aguardando Terceiro`, o Case é marcado como pausado e guarda o início da pausa.
- Ao voltar para trabalho, o prazo de trabalho é estendido pelo tempo útil pausado usando `BusinessHours.diff` e `BusinessHours.add`.
- Ao entrar em `Resolved`, `Resolvido`, `Closed` ou `Fechado`, a automação preenche o fim do trabalho.
- O status visível do SLA também considera `NOW()` para indicar vencimento na tela mesmo antes de uma atualização no registro.

## Próximos passos de Setup

1. Confirmar que os valores de `Case.Status` existem na org:
   - `New`
   - `Working`
   - `Aguardando Cliente`
   - `Aguardando Terceiro`
   - `Resolved` ou `Resolvido`

2. Criar/configurar no Setup o Business Hours `SLA Suporte 9x18`, pois o registry local do Salesforce CLI não aceitou deploy desse tipo de metadata.

3. Cadastrar feriados da empresa e associar ao Business Hours `SLA Suporte 9x18`.

4. Se o componente padrão `Milestones` for obrigatório, configurar Entitlement Management:
   - Entitlement Process `Case_SLA_Suporte`
   - Milestone `SLA Atendimento` de 120 minutos
   - Milestones `SLA Trabalho P0` a `SLA Trabalho P4`
   - Ações de violação para preencher `SLAAtendimentoViolado__c` e `SLATrabalhoViolado__c`

## Observação

A implementação Apex já entrega o controle operacional e visual do SLA nos campos do Case. A camada de Entitlement/Milestones é recomendada para usar a visualização padrão de milestones e alertas declarativos do Salesforce.

## Validação

Executado `sf project deploy start --dry-run` no org `dev-org` incluindo campos, validação, custom permission, permission set, Apex, trigger e layouts.

Resultado:

- Deploy check-only: sucesso
- Testes executados: `CaseSLATriggerHandlerTest`
- Quantidade de testes: 6
- Falhas: 0
