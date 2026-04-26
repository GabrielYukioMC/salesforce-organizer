public class ApontamentoBuilder {

    private static final Integer HORA_TRABALHO_INICIO = 9;
    private static final Integer HORA_TRABALHO_FIM    = 18;

    // Offset UTC do usuário (Brazil UTC-3): hora local = hora UTC + UTC_OFFSET
    // Uso: converter Datetime UTC para data local e criar limites de expediente em UTC
    private static final Integer UTC_OFFSET = -3;

    // Duração mínima de um slot para ser criado (15 minutos em milissegundos)
    private static final Long MIN_DURACAO_MS = 15L * 60 * 1000;

    /**
     * Arredonda um Datetime para o slot de meia hora mais próximo:
     *   0–15 min  → :00 (trunca para hora cheia)
     *  16–39 min  → :30 (meia hora)
     *  40–59 min  → :00 da próxima hora (arredonda pra cima)
     */
    @TestVisible
    private static Datetime arredondar(Datetime dt) {
        Integer min = dt.minuteGmt();

        if (min <= 15) {
            return Datetime.newInstanceGmt(
                dt.yearGmt(), dt.monthGmt(), dt.dayGmt(),
                dt.hourGmt(), 0, 0
            );
        } else if (min <= 39) {
            return Datetime.newInstanceGmt(
                dt.yearGmt(), dt.monthGmt(), dt.dayGmt(),
                dt.hourGmt(), 30, 0
            );
        } else {
            return Datetime.newInstanceGmt(
                dt.yearGmt(), dt.monthGmt(), dt.dayGmt(),
                dt.hourGmt(), 0, 0
            ).addHours(1);
        }
    }

    /** Calcula duração em horas com precisão de 0.5 a partir de dois Datetimes já arredondados */
    @TestVisible
    private static Decimal calcularDuracao(Datetime inicio, Datetime fim) {
        Long diffMs = fim.getTime() - inicio.getTime();
        return diffMs / (1000.0 * 60 * 60);
    }

    /** Monta o DTO para futura integração entre orgs */
    public static ApontamentoDTO buildFromTarefa(Tarefa__c t) {
        Datetime rawInicio = t.InicioTarefa__c != null ? t.InicioTarefa__c : DateTime.now().addHours(-1);
        Datetime rawFim    = t.FimTarefa__c    != null ? t.FimTarefa__c    : DateTime.now();

        Datetime inicio = arredondar(rawInicio);
        Datetime fim    = arredondar(rawFim);

        ApontamentoDTO dto = new ApontamentoDTO();
        dto.name             = t.Name;
        dto.ownerId          = t.UsuarioProprietario__c;
        dto.inicio           = inicio;
        dto.fim              = fim;
        dto.duracaoHoras     = calcularDuracao(inicio, fim);
        dto.observacoes      = t.Descricao__c;
        dto.projeto          = null;
        dto.perfilDeAlocacao = null;

        System.debug('### ApontamentoDTO gerado: ' + JSON.serialize(dto));
        return dto;
    }

    /**
     * Constrói uma lista de SObjects locais ApontamentoDeHoras__c a partir de uma Tarefa__c,
     * ocupando apenas os horários vagos (sem apontamentos já cadastrados).
     *
     * Tarefas que se estendem por múltiplos dias são quebradas em um registro por dia
     * (dentro do limite de trabalho 09:00–18:00). Dentro de cada dia, os intervalos
     * já ocupados por apontamentos existentes são subtraídos — o resultado são apenas
     * os sub-segmentos livres com duração mínima de 15 minutos.
     *
     * Os apontamentos existentes NÃO são modificados.
     */
    public static List<ApontamentoDeHoras__c> buildSObjectsFromTarefa(
        Tarefa__c t,
        List<ApontamentoDeHoras__c> existentes
    ) {
        Datetime rawInicio = t.InicioTarefa__c != null ? t.InicioTarefa__c : DateTime.now().addHours(-1);
        Datetime rawFim    = t.FimTarefa__c    != null ? t.FimTarefa__c    : DateTime.now();

        Datetime inicio = arredondar(rawInicio);
        Datetime fim    = arredondar(rawFim);

        List<ApontamentoDeHoras__c> resultado = new List<ApontamentoDeHoras__c>();

        Date dataInicio = inicio.addHours(UTC_OFFSET).dateGmt();
        Date dataFim    = fim.addHours(UTC_OFFSET).dateGmt();

        Date dataAtual = dataInicio;
        while (dataAtual <= dataFim) {
            Datetime segIni, segFim;

            if (dataAtual == dataInicio && dataAtual == dataFim) {
                segIni = inicio;
                segFim = fim;
            } else if (dataAtual == dataInicio) {
                segIni = inicio;
                segFim = limiteExpediente(dataAtual, HORA_TRABALHO_FIM);
            } else if (dataAtual == dataFim) {
                segIni = limiteExpediente(dataAtual, HORA_TRABALHO_INICIO);
                segFim = fim;
            } else {
                segIni = limiteExpediente(dataAtual, HORA_TRABALHO_INICIO);
                segFim = limiteExpediente(dataAtual, HORA_TRABALHO_FIM);
            }

            // Quebrar o segmento do dia nos slots livres, respeitando os existentes
            for (Datetime[] slot : calcularSlotsLivres(segIni, segFim, existentes)) {
                resultado.add(criarSegmento(t, slot[0], slot[1]));
            }

            dataAtual = dataAtual.addDays(1);
        }

        return resultado;
    }

    /**
     * Sobrecarga sem existentes — mantida para compatibilidade e testes.
     * Cria apontamentos sem checar sobreposições.
     */
    public static List<ApontamentoDeHoras__c> buildSObjectsFromTarefa(Tarefa__c t) {
        return buildSObjectsFromTarefa(t, new List<ApontamentoDeHoras__c>());
    }

    /**
     * Calcula os sub-intervalos livres dentro de [segIni, segFim],
     * subtraindo os apontamentos existentes que se sobreponham a esse intervalo.
     *
     * Retorna apenas slots com duração >= 15 minutos.
     * Os apontamentos existentes não são alterados.
     */
    @TestVisible
    private static List<Datetime[]> calcularSlotsLivres(
        Datetime segIni,
        Datetime segFim,
        List<ApontamentoDeHoras__c> existentes
    ) {
        // Filtrar somente os que sobrepoem com [segIni, segFim]
        List<ApontamentoDeHoras__c> sobrepostos = new List<ApontamentoDeHoras__c>();
        for (ApontamentoDeHoras__c ap : existentes) {
            if (ap.Inicio__c < segFim && ap.Fim__c > segIni) {
                sobrepostos.add(ap);
            }
        }

        // Ordenar por Inicio__c ASC (bubble sort — listas pequenas)
        for (Integer i = 0; i < sobrepostos.size() - 1; i++) {
            for (Integer j = 0; j < sobrepostos.size() - i - 1; j++) {
                if (sobrepostos[j].Inicio__c > sobrepostos[j + 1].Inicio__c) {
                    ApontamentoDeHoras__c tmp = sobrepostos[j];
                    sobrepostos[j]     = sobrepostos[j + 1];
                    sobrepostos[j + 1] = tmp;
                }
            }
        }

        List<Datetime[]> slots = new List<Datetime[]>();
        Datetime cursor = segIni;

        for (ApontamentoDeHoras__c ap : sobrepostos) {
            if (cursor >= segFim) break;

            // Há espaço livre antes deste apontamento?
            if (ap.Inicio__c > cursor) {
                Datetime slotFim = ap.Inicio__c < segFim ? ap.Inicio__c : segFim;
                if (slotFim.getTime() - cursor.getTime() >= MIN_DURACAO_MS) {
                    slots.add(new Datetime[]{ cursor, slotFim });
                }
            }

            // Avança o cursor para depois deste apontamento
            if (ap.Fim__c > cursor) {
                cursor = ap.Fim__c;
            }
        }

        // Espaço livre após o último apontamento (ou o segmento inteiro se não havia sobrepostos)
        if (cursor < segFim && segFim.getTime() - cursor.getTime() >= MIN_DURACAO_MS) {
            slots.add(new Datetime[]{ cursor, segFim });
        }

        return slots;
    }

    /**
     * Cria um Datetime UTC representando a hora local de expediente (9 ou 18) num dado dia local.
     * horaLocal (9 ou 18) → horaUTC = horaLocal - UTC_OFFSET = horaLocal + 3
     */
    private static Datetime limiteExpediente(Date diaLocal, Integer horaLocal) {
        Integer horaUtc = horaLocal - UTC_OFFSET; // ex: 9 - (-3) = 12; 18 - (-3) = 21
        return Datetime.newInstanceGmt(diaLocal.year(), diaLocal.month(), diaLocal.day(), horaUtc, 0, 0);
    }
private static ApontamentoDeHoras__c criarSegmento(Tarefa__c t, Datetime segIni, Datetime segFim) {
    ApontamentoDeHoras__c novo = new ApontamentoDeHoras__c(
        Name             = t.Name,
        OwnerId          = t.UsuarioProprietario__c,
        Inicio__c        = segIni,
        Fim__c           = segFim,
        Observacoes__c   = t.Descricao__c,
        ProjetoLookup__c = t.Projeto__c
    );

    if (t.Projeto__r != null && String.isNotBlank(t.Projeto__r.Id_Perfil_Alocacao_Elera__c)) {
        novo.PerfilDeAlocacao__c = t.Projeto__r.Id_Perfil_Alocacao_Elera__c;
    }

    return novo;
}

    /** Serialização preparada para futura integração via callout */
    public static String toJSON(ApontamentoDTO dto) {
        return JSON.serialize(dto);
    }
}
