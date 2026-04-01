public without sharing class ApontamentoFixoService {

    private static final Integer UTC_OFFSET       = -3;
    private static final Integer MIN_DURACAO_MIN  = 15;

    // Offsets a partir de domingo (semanaInicio = domingo da semana)
    private static final Map<String, Integer> DIA_OFFSET = new Map<String, Integer>{
        'Seg' => 1, 'Ter' => 2, 'Qua' => 3, 'Qui' => 4, 'Sex' => 5
    };

    // ── CRUD ─────────────────────────────────────────────────────────────

    public static void salvarRotina(ApontamentoFixo__c rotina) {
        if (String.isBlank(rotina.Name)) {
            throw new AuraHandledException('Nome da rotina é obrigatório.');
        }
        if (String.isBlank(rotina.DiaDaSemana__c)) {
            throw new AuraHandledException('Selecione ao menos um dia da semana.');
        }
        if (String.isBlank(rotina.HoraInicio__c) || String.isBlank(rotina.HoraFim__c)) {
            throw new AuraHandledException('Hora de início e hora de fim são obrigatórias.');
        }

        Integer[] hIni = parseHHMM(rotina.HoraInicio__c);
        Integer[] hFim = parseHHMM(rotina.HoraFim__c);

        Integer totalIni = hIni[0] * 60 + hIni[1];
        Integer totalFim = hFim[0] * 60 + hFim[1];

        if (totalFim <= totalIni) {
            throw new AuraHandledException('Hora de fim deve ser maior que hora de início.');
        }
        if ((totalFim - totalIni) < MIN_DURACAO_MIN) {
            throw new AuraHandledException('A rotina deve ter duração mínima de 15 minutos.');
        }

        // Normalizar para "HH:MM" antes de persistir, independente do formato recebido do LWC
        rotina.HoraInicio__c = String.valueOf(hIni[0]).leftPad(2, '0') + ':' + String.valueOf(hIni[1]).leftPad(2, '0');
        rotina.HoraFim__c    = String.valueOf(hFim[0]).leftPad(2, '0') + ':' + String.valueOf(hFim[1]).leftPad(2, '0');

        if (rotina.Id == null) {
            insert rotina;
        } else {
            update rotina;
        }
    }

    public static void deletarRotina(Id rotinaId) {
        if (rotinaId == null) {
            throw new AuraHandledException('ID da rotina não informado.');
        }
        delete new ApontamentoFixo__c(Id = rotinaId);
    }

    // ── GERAÇÃO DE SEMANA ─────────────────────────────────────────────────

    public static void gerarApontamentosSemana(String semanaInicioISO) {
        Date semanaInicio = Date.valueOf(semanaInicioISO);
        Datetime wIni = Datetime.newInstanceGmt(semanaInicio, Time.newInstance(0, 0, 0, 0));
        Datetime wFim = wIni.addDays(7);

        Id userId = UserInfo.getUserId();

        List<ApontamentoFixo__c> fixos = ApontamentoFixoSelector.buscarPorUsuario(userId);
        if (fixos.isEmpty()) return;

        List<ApontamentoDeHoras__c> existentes =
            ApontamentoSelector.buscarPorPeriodo(userId, wIni, wFim);

        // Agrupar existentes por data local (YYYY-MM-DD no fuso BRT)
        Map<String, List<ApontamentoDeHoras__c>> porDia =
            new Map<String, List<ApontamentoDeHoras__c>>();
        for (ApontamentoDeHoras__c ap : existentes) {
            String chave = utcParaDataLocalStr(ap.Inicio__c);
            if (!porDia.containsKey(chave)) {
                porDia.put(chave, new List<ApontamentoDeHoras__c>());
            }
            porDia.get(chave).add(ap);
        }

        // Acumular DML em maps/listas para evitar conflitos entre rotinas no mesmo dia
        Map<Id, ApontamentoDeHoras__c> toUpdateMap = new Map<Id, ApontamentoDeHoras__c>();
        Set<Id>                        toDeleteIds  = new Set<Id>();
        List<ApontamentoDeHoras__c>    toInsert     = new List<ApontamentoDeHoras__c>();

        for (ApontamentoFixo__c fixo : fixos) {
            Integer[] hIni = parseHHMM(fixo.HoraInicio__c);
            Integer[] hFim = parseHHMM(fixo.HoraFim__c);

            List<String> dias = fixo.DiaDaSemana__c.split(';');
            for (String diaToken : dias) {
                diaToken = diaToken.trim();
                if (!DIA_OFFSET.containsKey(diaToken)) continue;

                Date diaLocal = semanaInicio.addDays(DIA_OFFSET.get(diaToken));
                String chave  = dataStr(diaLocal);

                Datetime fIni = localParaUtc(diaLocal, hIni[0], hIni[1]);
                Datetime fFim = localParaUtc(diaLocal, hFim[0], hFim[1]);

                // Resolver sobreposições com existentes desse dia
                List<ApontamentoDeHoras__c> doDia =
                    porDia.containsKey(chave) ? porDia.get(chave) : new List<ApontamentoDeHoras__c>();

                resolverSobreposicoes(fIni, fFim, doDia, toUpdateMap, toDeleteIds, toInsert);

                // Inserir o apontamento da rotina fixa
                ApontamentoDeHoras__c novo = new ApontamentoDeHoras__c(
                    Name              = fixo.Name,
                    Inicio__c         = fIni,
                    Fim__c            = fFim,
                    Projeto__c        = fixo.Projeto__c,
                    PerfilDeAlocacao__c = fixo.PerfilDeAlocacao__c
                );
                toInsert.add(novo);
            }
        }

        // Remover dos updates os registros que serão deletados
        for (Id dId : toDeleteIds) {
            toUpdateMap.remove(dId);
        }

        Savepoint sp = Database.setSavepoint();
        try {
            if (!toDeleteIds.isEmpty()) {
                List<ApontamentoDeHoras__c> toDeleteList = new List<ApontamentoDeHoras__c>();
                for (Id dId : toDeleteIds) {
                    toDeleteList.add(new ApontamentoDeHoras__c(Id = dId));
                }
                delete toDeleteList;
            }
            if (!toUpdateMap.isEmpty()) {
                update toUpdateMap.values();
            }
            if (!toInsert.isEmpty()) {
                insert toInsert;
            }
        } catch (Exception e) {
            Database.rollback(sp);
            throw new AuraHandledException('Erro ao gerar apontamentos: ' + e.getMessage());
        }
    }

    // ── ALGORITMO DE SOBREPOSIÇÃO ─────────────────────────────────────────

    @TestVisible
    private static void resolverSobreposicoes(
        Datetime fIni,
        Datetime fFim,
        List<ApontamentoDeHoras__c> existentes,
        Map<Id, ApontamentoDeHoras__c> toUpdateMap,
        Set<Id> toDeleteIds,
        List<ApontamentoDeHoras__c> toInsert
    ) {
        for (ApontamentoDeHoras__c e : existentes) {
            if (toDeleteIds.contains(e.Id)) continue;

            // Pegar versão atual (pode já ter sido modificada por rotina anterior)
            ApontamentoDeHoras__c atual = toUpdateMap.containsKey(e.Id) ? toUpdateMap.get(e.Id) : e;
            Datetime eIni = atual.Inicio__c;
            Datetime eFim = atual.Fim__c;

            // Caso 0: sem sobreposição
            if (eFim <= fIni || eIni >= fFim) continue;

            // Caso 1: F contém E inteiro → deletar E
            if (eIni >= fIni && eFim <= fFim) {
                toDeleteIds.add(e.Id);
                continue;
            }

            // Caso 4: E contém F inteiro → partir E em dois
            if (eIni < fIni && eFim > fFim) {
                // Lado esquerdo: [eIni, fIni]
                if (abaixoDoMinimo(eIni, fIni)) {
                    toDeleteIds.add(e.Id);
                } else {
                    ApontamentoDeHoras__c upd = clonarComNovoFim(atual, fIni);
                    toUpdateMap.put(e.Id, upd);
                }
                // Lado direito: [fFim, eFim]
                if (!abaixoDoMinimo(fFim, eFim)) {
                    ApontamentoDeHoras__c split = clonarNovoRegistro(atual, fFim, eFim);
                    toInsert.add(split);
                }
                continue;
            }

            // Caso 2: F corta início de E → E avança início para fFim
            // Condição: eIni >= fIni && eIni < fFim && eFim > fFim
            if (eIni >= fIni && eIni < fFim && eFim > fFim) {
                if (abaixoDoMinimo(fFim, eFim)) {
                    toDeleteIds.add(e.Id);
                } else {
                    ApontamentoDeHoras__c upd = clonarComNovoInicio(atual, fFim);
                    toUpdateMap.put(e.Id, upd);
                }
                continue;
            }

            // Caso 3: F corta fim de E → E recua fim para fIni
            // Condição: eIni < fIni && eFim > fIni && eFim <= fFim
            if (eIni < fIni && eFim > fIni && eFim <= fFim) {
                if (abaixoDoMinimo(eIni, fIni)) {
                    toDeleteIds.add(e.Id);
                } else {
                    ApontamentoDeHoras__c upd = clonarComNovoFim(atual, fIni);
                    toUpdateMap.put(e.Id, upd);
                }
                continue;
            }
        }
    }

    // ── HELPERS PRIVADOS ─────────────────────────────────────────────────

    @TestVisible
    private static Integer[] parseHHMM(String horaTexto) {
        if (String.isBlank(horaTexto) || !horaTexto.contains(':')) {
            throw new AuraHandledException('Formato de hora inválido: "' + horaTexto + '". Use HH:MM.');
        }
        // lightning-input type="time" pode retornar "HH:MM:SS.mmm" — usar apenas HH e MM
        List<String> partes = horaTexto.split(':');
        if (partes.size() < 2) {
            throw new AuraHandledException('Formato de hora inválido: "' + horaTexto + '". Use HH:MM.');
        }
        try {
            Integer horas   = Integer.valueOf(partes[0]);
            Integer minutos = Integer.valueOf(partes[1]);
            if (horas < 0 || horas > 23 || minutos < 0 || minutos > 59) {
                throw new AuraHandledException('Hora fora do intervalo válido: "' + horaTexto + '".');
            }
            return new Integer[]{ horas, minutos };
        } catch (TypeException ex) {
            throw new AuraHandledException('Formato de hora inválido: "' + horaTexto + '". Use HH:MM.');
        }
    }

    @TestVisible
    private static Datetime localParaUtc(Date diaLocal, Integer horaLocal, Integer minLocal) {
        Integer horaUtc = horaLocal - UTC_OFFSET; // BRT UTC-3 → +3 para UTC
        Integer diaOffset = 0;
        if (horaUtc >= 24) { horaUtc -= 24; diaOffset = 1; }
        if (horaUtc < 0)   { horaUtc += 24; diaOffset = -1; }
        return Datetime.newInstanceGmt(
            diaLocal.addDays(diaOffset).year(),
            diaLocal.addDays(diaOffset).month(),
            diaLocal.addDays(diaOffset).day(),
            horaUtc, minLocal, 0
        );
    }

    @TestVisible
    private static Boolean abaixoDoMinimo(Datetime ini, Datetime fim) {
        Long diffMs = fim.getTime() - ini.getTime();
        return diffMs < (MIN_DURACAO_MIN * 60 * 1000L);
    }

    private static String utcParaDataLocalStr(Datetime dtUtc) {
        // Converter UTC para BRT adicionando offset (UTC-3 → subtrair 3h)
        Datetime dtLocal = dtUtc.addHours(UTC_OFFSET);
        return String.valueOf(dtLocal.dateGmt());
    }

    private static String dataStr(Date d) {
        return String.valueOf(d);
    }

    private static ApontamentoDeHoras__c clonarComNovoFim(ApontamentoDeHoras__c src, Datetime novoFim) {
        ApontamentoDeHoras__c ap = new ApontamentoDeHoras__c(
            Id                  = src.Id,
            Inicio__c           = src.Inicio__c,
            Fim__c              = novoFim,
            Name                = src.Name,
            Projeto__c          = src.Projeto__c,
            PerfilDeAlocacao__c = src.PerfilDeAlocacao__c,
            Observacoes__c      = src.Observacoes__c
        );
        return ap;
    }

    private static ApontamentoDeHoras__c clonarComNovoInicio(ApontamentoDeHoras__c src, Datetime novoInicio) {
        ApontamentoDeHoras__c ap = new ApontamentoDeHoras__c(
            Id                  = src.Id,
            Inicio__c           = novoInicio,
            Fim__c              = src.Fim__c,
            Name                = src.Name,
            Projeto__c          = src.Projeto__c,
            PerfilDeAlocacao__c = src.PerfilDeAlocacao__c,
            Observacoes__c      = src.Observacoes__c
        );
        return ap;
    }

    private static ApontamentoDeHoras__c clonarNovoRegistro(ApontamentoDeHoras__c src, Datetime ini, Datetime fim) {
        return new ApontamentoDeHoras__c(
            Name                = src.Name,
            Inicio__c           = ini,
            Fim__c              = fim,
            Projeto__c          = src.Projeto__c,
            PerfilDeAlocacao__c = src.PerfilDeAlocacao__c,
            Observacoes__c      = src.Observacoes__c
        );
    }
}
