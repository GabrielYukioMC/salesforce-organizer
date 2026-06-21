# Contexto Tecnico - Financeiro

Fonte: retrieve da org `dev-org` realizado em `2026-06-20 23:17:14 -03`, com API `65.0`. Antes desta analise, Apex Classes e Lightning Web Components foram recuperados da org para atualizar o workspace local.

## Escopo

Este documento consolida o modulo financeiro: transacoes, metas financeiras, dashboard, widgets e recursos de grafico.

Arquivos principais:

- `force-app/main/default/objects/Transacao__c`
- `force-app/main/default/objects/Meta__c`
- `force-app/main/default/objects/Account/fields/RendaMensal__c.field-meta.xml`
- `force-app/main/default/classes/TransferenciaController.cls`
- `force-app/main/default/classes/TransferenciaService.cls`
- `force-app/main/default/classes/TransferenciaSelector.cls`
- `force-app/main/default/classes/MetaController.cls`
- `force-app/main/default/classes/MetaService.cls`
- `force-app/main/default/classes/MetaSelector.cls`
- `force-app/main/default/lwc/dashboardFinanceiro`
- `force-app/main/default/lwc/calendarioFinanceiro`
- `force-app/main/default/lwc/contasPagar`
- `force-app/main/default/lwc/metasFinanceiras`
- `force-app/main/default/lwc/orcamentoMensal`
- `force-app/main/default/lwc/resumoMensal`
- `force-app/main/default/lwc/simuladorFinanceiro`
- `force-app/main/default/staticresources/chart.js`

## Modelo De Dados

### `Transacao__c`

Configuracao:

- Label: `Transação`
- Plural: `Transações`
- Deployment: `Deployed`
- Sharing model: `ReadWrite`

Campos:

| Campo | Tipo | Uso tecnico |
|---|---|---|
| `Name` | Name | Nome/descricao da movimentacao. |
| `Tipo__c` | Picklist obrigatoria | Valores: `Entrada`, `Saída`. Tambem usado para definir Record Type. |
| `Categoria__c` | Picklist obrigatoria | Value set global restrito `Categorias`. |
| `Valor__c` | Currency obrigatorio | Valor financeiro positivo; o sinal e inferido por `Tipo__c`. |
| `Data__c` | DateTime | Data da transacao. Usada em filtros mensais e contas a pagar. |
| `Pago__c` | Checkbox | Usado em contas a pagar. Default `false`. |
| `Recorrente__c` | Checkbox | Ativa clonagem automatica. Default `false`. |
| `Frequencia__c` | Picklist | Metadata possui `Mensal`, `Semestral`, `Anual`, `Semanal`, `Unica`. |
| `BancoRelacionado__c` | Lookup `Account` | Relacionamento opcional com conta/banco. |

Record Types:

| DeveloperName | Label | Observacao |
|---|---|---|
| `Entrada` | `Entrada` | Ativo. |
| `Saida` | `Saída` | Ativo. |

Observacao critica: os record types recuperados permitem `Frequencia__c` apenas com `Anual` e `Mensal`, enquanto o Apex e o LWC suportam `Semestral`. Como a picklist e restrita, uma transacao recorrente semestral pode falhar em DML quando o Record Type for aplicado.

Categorias visiveis nos record types incluem:

- `Aluguel`
- `Cartão de credito`
- `Conforto`
- `Conhecimento`
- `Custos fixos`
- `Diario`
- `Economia`
- `Fixa` somente no record type `Saida`
- `Investimento`
- `Investir`
- `Liberdade financeira`
- `Mercado`
- `Objetivos`
- `Prazeres`
- `Renda Extra`
- `Renda Passiva`
- `Reserva de Emergencia`
- `Salario`

### `Meta__c`

Configuracao:

- Label: `Meta`
- Plural: `Metas`
- Deployment: `Deployed`
- Sharing model: `ReadWrite`

Campos:

| Campo | Tipo | Uso tecnico |
|---|---|---|
| `Name` | Name | Nome da meta. Obrigatorio via Apex. |
| `Ativa__c` | Checkbox | Somente uma meta ativa deve existir por usuario. |
| `Descricao__c` | LongTextArea | Observacoes da meta. |
| `GastosFixos__c` | Percent obrigatorio | Percentual de alocacao. |
| `ReservaEmergencia__c` | Percent obrigatorio | Percentual de alocacao. |
| `Investimentos__c` | Percent obrigatorio | Percentual de alocacao. |
| `QualidadeDeVida__c` | Percent obrigatorio | Percentual de alocacao. |
| `DesenvolvimentoPessoal__c` | Percent obrigatorio | Percentual de alocacao. |
| `Objetivos__c` | Percent obrigatorio | Percentual de alocacao. |
| `UsuarioProprietario__c` | Lookup `User` | Preenchido no service, mas os selectors usam `OwnerId`. |

Regra central: a soma dos seis percentuais deve ser exatamente `100`.

### `Account`

Campo financeiro recuperado:

- `Account.RendaMensal__c`: Currency, usado em contexto financeiro/CRM.

Tambem foi recuperado o Record Type `Account.Banco`, relevante para relacionamento de transacoes com contas/bancos.

## Camada Apex

Padrao:

`LWC -> Controller -> Service -> Selector -> SObject`

### Transacoes

Classes:

- `TransferenciaController`
- `TransferenciaService`
- `TransferenciaSelector`

Metodos expostos:

| Metodo | Tipo | Comportamento |
|---|---|---|
| `realizarTransferencia(Transacao__c)` | DML insert | Define Record Type por label de `Tipo__c`; cria copias se recorrente. |
| `deletarTransacao(Id)` | DML delete | Deleta apenas se `OwnerId = UserInfo.getUserId()`. |
| `atualizarTransacao(Transacao__c)` | DML update | Atualiza payload recebido sem reconsultar ownership. |
| `getContasAPagar()` | cacheable | Saidas nao pagas dos proximos 60 dias. |
| `getResumoMensal(Integer)` | cacheable | Totais de entradas, saidas, saldo e taxa de poupanca por mes. |
| `getTotaisPatrimonioAtual()` | cacheable | Soma categorias de reserva/investimento ate hoje. |
| `getTransacoesPorUsuarioEData(String)` | AuraEnabled | Espera `YYYY-MM`; retorna transacoes do mes. |

Recorrencia em `TransferenciaService`:

- Nao recorrente: insere 1 registro.
- `Mensal`: 12 registros, `Data__c.addMonths(i)`.
- `Semestral`: 2 registros, `Data__c.addMonths(i * 6)`.
- `Anual`: 3 registros, `Data__c.addYears(i)`.

Resumo mensal:

- Soma `Tipo__c = Entrada` como entrada.
- Qualquer outro tipo entra como saida.
- `taxaPoupanca = saldo / totalEntradas * 100`.

Patrimonio atual:

- Considera apenas `Tipo__c = 'Saída'`.
- Categorias de reserva: `Reserva de Emergencia`, `Economia`.
- Categorias de investimento: `Investimento`, `Liberdade financeira`.
- O modelo trata aporte/investimento como saida do caixa e soma para patrimonio.

### Metas

Classes:

- `MetaController`
- `MetaService`
- `MetaSelector`

Metodos expostos:

| Metodo | Tipo | Comportamento |
|---|---|---|
| `criarMeta(Meta__c)` | DML insert | Valida nome e soma 100; preenche `UsuarioProprietario__c`; desativa outras se nova meta vier ativa. |
| `atualizarMeta(Meta__c)` | DML update | Valida soma 100; se ativa, desativa as demais; atualiza campos permitidos. |
| `deletarMeta(Id)` | DML delete | Deleta por Id. |
| `buscarMetasDoUsuario()` | cacheable | Busca por `OwnerId = UserInfo.getUserId()`. |
| `buscarMetaAtiva()` | cacheable | Busca primeira ativa por `OwnerId`. |
| `ativarMeta(Id)` | DML update | Marca uma meta ativa e as demais inativas. |

## Lightning Web Components

Container:

- `dashboardFinanceiro` e exposto em `lightning__AppPage`, `lightning__HomePage`, `lightning__RecordPage` e `lightning__Tab`.
- Custom Tab `Central_Financeiro` aponta para `dashboardFinanceiro`.
- App `Gerenciador_Geral` inclui `Central_Financeiro`.
- App `GerenciadorFinanceiro` inclui tabs de objetos (`Transacao__c`, `Projeto__c`, `ApontamentoDeHoras__c`, `Comprador__c`), mas nao inclui `Central_Financeiro`.

Abas do `dashboardFinanceiro`:

- `Orçamento Doméstico` -> `orcamentoMensal`
- `Contas` -> `contasPagar`
- `Calendario Financeiro` -> `calendarioFinanceiro`
- `Metas` -> `metasFinanceiras`
- `Investimentos` -> placeholder
- `Resumo Mensal` -> `resumoMensal`
- `Simulador` -> `simuladorFinanceiro`

Dependencias LWC -> Apex:

| LWC | Apex |
|---|---|
| `calendarioFinanceiro` | `getTransacoesPorUsuarioEData`, `realizarTransferencia`, `deletarTransacao`, `atualizarTransacao` |
| `contasPagar` | `getContasAPagar`, `atualizarTransacao` |
| `metasFinanceiras` | Todos os metodos principais de `MetaController` |
| `orcamentoMensal` | `realizarTransferencia`, `getTransacoesPorUsuarioEData`, `buscarMetaAtiva` |
| `resumoMensal` | `getResumoMensal` |
| `simuladorFinanceiro` | `buscarMetaAtiva`, `getResumoMensal`, `getTotaisPatrimonioAtual` |
| `homeWidget` | Tarefas do dia, transacoes do mes atual e meta ativa |

Recurso estatico:

- `chart` (`chart.js`) com content type `application/javascript`.
- Usado por `orcamentoMensal`, `resumoMensal` e `simuladorFinanceiro`.

## Cenarios Para Orquestracao Tecnica

Criacao de transacao:

- Enviar `Transacao__c` para `TransferenciaController.realizarTransferencia`.
- Preencher `Name`, `Tipo__c`, `Categoria__c`, `Valor__c`, `Data__c`.
- Se recorrente, preencher `Recorrente__c = true` e `Frequencia__c`.
- Validar previamente se `Frequencia__c` e permitida pelo record type do `Tipo__c`.

Atualizacao de transacao:

- `calendarioFinanceiro` envia payload com `Id`, `Name`, `Tipo__c`, `Categoria__c`, `Valor__c`, `Data__c`, `Pago__c`.
- `contasPagar` envia payload minimo `{ Id, Pago__c: true }`.
- O service atualiza diretamente o objeto recebido; se a orquestracao criar outro endpoint, deve aplicar allowlist de campos e filtro de owner.

Validacao financeira:

- `Tipo__c` deve ser exatamente `Entrada` ou `Saída`.
- Categorias devem bater com o value set restrito `Categorias`.
- `Meta__c` exige soma de percentuais igual a 100 no LWC e no Apex.
- Para patrimonio atual, manter os textos de categoria usados no selector, principalmente sem acento em `Reserva de Emergencia`.

Deduplicacao:

- Nao ha deduplicacao nativa de transacoes recorrentes. Criar uma recorrencia duas vezes gera duplicatas.
- Nao ha chave externa em `Transacao__c`.
- Se for integrar extrato bancario, recomenda-se criar chave tecnica por banco/data/valor/descricao ou External Id.

Integracao:

- Nao foi encontrado callout financeiro externo.
- O modulo usa dados locais em `Transacao__c`, `Meta__c` e eventualmente `Account`.

## Riscos E Pontos De Atencao

- Conflito entre Apex/LWC e metadata: `Semestral` e suportado pelo codigo, mas nao aparece nos valores permitidos de `Frequencia__c` nos record types `Entrada` e `Saida`.
- `TransferenciaService.atualizarTransacao` esta `without sharing` e atualiza o payload sem revalidar `OwnerId`.
- `MetaService.deletarMeta` deleta por Id sem revalidar `OwnerId`.
- `MetaService` preenche `UsuarioProprietario__c`, mas `MetaSelector` filtra por `OwnerId`; se ownership mudar, a meta pode aparecer para outro usuario mesmo com lookup custom antigo.
- `Data__c` e DateTime, mas muitos calculos no LWC usam `new Date(...)`; pode haver diferenca de dia por timezone.
- Categorias sao strings de negocio usadas em Apex. Ajustes de picklist precisam refletir selectors, dashboards e simulador.
- `movimentacoesFixas` foi recuperado, mas nao esta conectado a Apex nos imports atuais.

