public class ApontamentoBuilder {

    private static final Integer HORA_TRABALHO_INICIO = 9;
    private static final Integer HORA_TRABALHO_FIM    = 18;

    // Offset UTC do usuário (Brazil UTC-3): hora local = hora UTC + UTC_OFFSET
    // Uso: converter Datetime UTC para data local e criar limites de expediente em UTC
    private static final Integer UTC_OFFSET = -3;

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
     * Constrói uma lista de SObjects locais ApontamentoDeHoras__c a partir de uma Tarefa__c.
     *
     * Tarefas que se estendem por múltiplos dias são quebradas em um registro por dia,
     * sempre dentro do limite de trabalho 09:00–18:00.
     *
     * Exemplo: tarefa de segunda 10:00 a quarta 14:00 gera:
     *   - Seg 10:00–18:00
     *   - Ter 09:00–18:00
     *   - Qua 09:00–14:00
     */
    public static List<ApontamentoDeHoras__c> buildSObjectsFromTarefa(Tarefa__c t) {
        Datetime rawInicio = t.InicioTarefa__c != null ? t.InicioTarefa__c : DateTime.now().addHours(-1);
        Datetime rawFim    = t.FimTarefa__c    != null ? t.FimTarefa__c    : DateTime.now();

        Datetime inicio = arredondar(rawInicio);
        Datetime fim    = arredondar(rawFim);

        List<ApontamentoDeHoras__c> resultado = new List<ApontamentoDeHoras__c>();

        // Usa a data LOCAL do usuário (UTC-3), não a data da org (UTC-5 americano).
        // Para obter a data local a partir do UTC armazenado: subtrai o offset.
        // UTC_OFFSET = -3  →  local = UTC + (-3)  →  inicio.addHours(-3).dateGmt()
        Date dataInicio = inicio.addHours(UTC_OFFSET).dateGmt();
        Date dataFim    = fim.addHours(UTC_OFFSET).dateGmt();

        // Mesmo dia: um único registro
        if (dataInicio == dataFim) {
            resultado.add(criarSegmento(t, inicio, fim));
            // insert resultado;
            return resultado;
        }

        // Multi-dia: percorre cada dia e cria o segmento correspondente
        Date dataAtual = dataInicio;
        while (dataAtual <= dataFim) {
            Datetime segIni, segFim;

            if (dataAtual == dataInicio) {
                // Primeiro dia: da hora real até o fim do expediente (18:00 local = 21:00 UTC)
                segIni = inicio;
                segFim = limiteExpediente(dataAtual, HORA_TRABALHO_FIM);
            } else if (dataAtual == dataFim) {
                // Último dia: do início do expediente (09:00 local = 12:00 UTC) à hora real
                segIni = limiteExpediente(dataAtual, HORA_TRABALHO_INICIO);
                segFim = fim;
            } else {
                // Dias intermediários: expediente completo
                segIni = limiteExpediente(dataAtual, HORA_TRABALHO_INICIO);
                segFim = limiteExpediente(dataAtual, HORA_TRABALHO_FIM);
            }

            resultado.add(criarSegmento(t, segIni, segFim));
            dataAtual = dataAtual.addDays(1);
        }

        return resultado;
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
        Name           = t.Name,
        OwnerId        = t.UsuarioProprietario__c,
        Inicio__c      = segIni,
        Fim__c         = segFim,
        Observacoes__c = t.Descricao__c
    );

    

    return novo;
}

    /** Serialização preparada para futura integração via callout */
    public static String toJSON(ApontamentoDTO dto) {
        return JSON.serialize(dto);
    }
}
