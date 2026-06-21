# Portable Install

## Objetivo

Instalar as instrucoes operacionais do agente em outro projeto Salesforce, sem configurar validacao automatica de Work, autenticacao JWT, alias de org ou consulta a registros externos.

## Instalacao rapida

Extraia o ZIP na raiz do projeto destino preservando os caminhos relativos.

## Resultado esperado

- As regras de agente ficam disponiveis no projeto destino.
- Nenhuma tarefa local executa autenticacao, consulta externa ou validacao automatica de Work.
- Nenhuma chave privada, token, senha, client secret ou arquivo `.env` real e incluida no pacote.

## Conferencia do pacote

O pacote contem:

- instrucoes de agente;
- regras auxiliares;
- exemplo de variaveis de ambiente sem valores sensiveis;
- documentacao minima de instalacao;
- lista de dependencias.

O pacote nao contem chave privada, tokens, refresh tokens, senha, client secret, `.sf/`, `.sfdx/` ou `.env` real.
