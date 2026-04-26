public without sharing class TransferenciaSelector {
   

    public static List<Transacao__c> buscarTransferenciasPorUsuario() {
        return [SELECT Id, Name, Valor__c, Data__c, Tipo__c, RecordTypeId FROM Transacao__c WHERE OwnerId = :UserInfo.getUserId()  ];
    }

    public static List<Transacao__c> buscarTransferenciasPorUsuarioEData(Date dataInicio, Date dataFim) {
        return [SELECT Id, Name, Valor__c, Data__c, Tipo__c, Categoria__c, Pago__c, Recorrente__c, Frequencia__c, RecordTypeId FROM Transacao__c WHERE OwnerId = :UserInfo.getUserId() AND Data__c >= :dataInicio AND Data__c <= :dataFim];
    }

    public static Map<String, Decimal> buscarTotaisPatrimonioAtual() {
        Map<String, Decimal> totais = new Map<String, Decimal>{
            'totalReserva'    => 0,
            'totalInvestido'  => 0
        };

        Set<String> categoriasReserva      = new Set<String>{ 'Reserva de Emergencia', 'Economia' };
        Set<String> categoriasInvestimento = new Set<String>{ 'Investimento', 'Liberdade financeira' };
        Set<String> todasCategorias        = new Set<String>();
        todasCategorias.addAll(categoriasReserva);
        todasCategorias.addAll(categoriasInvestimento);

        Date hoje = Date.today();

        for (AggregateResult resultado : [
            SELECT Categoria__c, SUM(Valor__c) totalValor
            FROM Transacao__c
            WHERE OwnerId = :UserInfo.getUserId()
            AND Tipo__c = 'Saída'
            AND Categoria__c IN :todasCategorias
            AND Data__c <= :hoje
            GROUP BY Categoria__c
        ]) {
            String categoria  = (String)  resultado.get('Categoria__c');
            Decimal valorTotal = (Decimal) resultado.get('totalValor');
            if (valorTotal == null) valorTotal = 0;

            if (categoriasReserva.contains(categoria)) {
                totais.put('totalReserva', totais.get('totalReserva') + valorTotal);
            } else if (categoriasInvestimento.contains(categoria)) {
                totais.put('totalInvestido', totais.get('totalInvestido') + valorTotal);
            }
        }

        return totais;
    }

    public static List<Transacao__c> buscarContasAPagar() {
        Date hoje = Date.today();
        Date limite = hoje.addDays(60);
        return [
            SELECT Id, Name, Valor__c, Data__c, Tipo__c, Categoria__c
            FROM Transacao__c
            WHERE OwnerId = :UserInfo.getUserId()
            AND Pago__c = false
            AND Tipo__c = 'Saída'
            AND Data__c >= :hoje
            AND Data__c <= :limite
            ORDER BY Data__c ASC
            LIMIT 200
        ];
    }
}