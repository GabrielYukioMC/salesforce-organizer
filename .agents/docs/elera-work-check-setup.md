# Work Check Setup

## Status

A configuracao de validacao automatica de Work por script, alias de org, JWT Bearer Flow e usuario de integracao foi removida deste pacote.

## Seguranca

Nao registre no repositorio:

- senha;
- token;
- refresh token;
- client secret;
- chave privada;
- arquivo `.env` real;
- arquivos `.key`, `.pem`, `.p12` ou `.jks`.

Qualquer autenticacao necessaria ao projeto destino deve ser configurada fora deste pacote e documentada no proprio projeto.
