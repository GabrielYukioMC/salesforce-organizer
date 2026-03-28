public without sharing class TransferenciaService {
     

   public static void realizarTransferencia(Transacao__c novaTransferencia) {

    if (novaTransferencia == null) {
        throw new AuraHandledException('A transferência não pode ser nula.');
    }

    Map<String, Schema.RecordTypeInfo> rtInfos = Schema.SObjectType.Transacao__c.getRecordTypeInfosByName();
    if (rtInfos.containsKey(novaTransferencia.Tipo__c)) {
        novaTransferencia.RecordTypeId = rtInfos.get(novaTransferencia.Tipo__c).getRecordTypeId();
    }

    List<Transacao__c> lista = new List<Transacao__c>();

    if (!novaTransferencia.Recorrente__c) {
        lista.add(novaTransferencia);
    } 
    else {

        Integer quantidade = 1;
        Integer mesesIncremento = 0;

        if (novaTransferencia.Frequencia__c == 'Mensal') {
            quantidade = 12;
            mesesIncremento = 1;
        }
        else if (novaTransferencia.Frequencia__c == 'Semestral') {
            quantidade = 2;
            mesesIncremento = 6;
        }
        else if (novaTransferencia.Frequencia__c == 'Anual') {
            quantidade = 3;
        }

        for (Integer i = 0; i < quantidade; i++) {

            Transacao__c nova = novaTransferencia.clone(false, true, false, false);

            if (novaTransferencia.Frequencia__c == 'Anual') {
                nova.Data__c = novaTransferencia.Data__c.addYears(i);
            } else {
                nova.Data__c = novaTransferencia.Data__c.addMonths(i * mesesIncremento);
            }

            lista.add(nova);
        }
    }

    insert lista;
}


    public static void deletarTransacao(Id transacaoId) {
        if (transacaoId == null) {
            throw new AuraHandledException('ID da transação não pode ser nulo.');
        }
        delete [SELECT Id FROM Transacao__c WHERE Id = :transacaoId AND OwnerId = :UserInfo.getUserId() LIMIT 1];
    }

    public static void atualizarTransacao(Transacao__c transacao) {
        if (transacao == null || transacao.Id == null) {
            throw new AuraHandledException('Transação inválida para atualização.');
        }
        update transacao;
    }

    public static List<Transacao__c> getContasAPagar() {
        return TransferenciaSelector.buscarContasAPagar();
    }

    public static List<Map<String, Object>> getResumoMensal(Integer meses) {
        List<Map<String, Object>> resultado = new List<Map<String, Object>>();
        Date hoje = Date.today();
        for (Integer i = meses - 1; i >= 0; i--) {
            Date dataInicio = Date.newInstance(hoje.year(), hoje.month(), 1).addMonths(-i);
            Date dataFim = dataInicio.addMonths(1).addDays(-1);
            List<Transacao__c> lista = TransferenciaSelector.buscarTransferenciasPorUsuarioEData(dataInicio, dataFim);
            Decimal totalEntradas = 0;
            Decimal totalSaidas = 0;
            for (Transacao__c t : lista) {
                if (t.Tipo__c == 'Entrada') totalEntradas += t.Valor__c;
                else totalSaidas += t.Valor__c;
            }
            Decimal saldo = totalEntradas - totalSaidas;
            Decimal taxaPoupanca = totalEntradas > 0 ? (saldo / totalEntradas * 100).setScale(1) : 0;
            resultado.add(new Map<String, Object>{
                'mes'          => dataInicio.format(),
                'mesLabel'     => String.valueOf(dataInicio.month()) + '/' + String.valueOf(dataInicio.year()),
                'totalEntradas'=> totalEntradas,
                'totalSaidas'  => totalSaidas,
                'saldo'        => saldo,
                'taxaPoupanca' => taxaPoupanca
            });
        }
        return resultado;
    }

    public static  List<Transacao__c> getTransacoesPorUsuarioEData(String data) {
        List<String> partesData = data.split('-');
        Integer ano = Integer.valueOf(partesData[0]);
        Integer mes = Integer.valueOf(partesData[1]);
        Date dataInicio = Date.newInstance(ano, mes, 1);
        Date dataFim = dataInicio.addMonths(1).addDays(-1);
        return TransferenciaSelector.buscarTransferenciasPorUsuarioEData(dataInicio, dataFim);
    }
}