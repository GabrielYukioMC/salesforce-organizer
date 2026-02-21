public without sharing class TransferenciaService {
     

   public static void realizarTransferencia(Transacao__c novaTransferencia) {

    if (novaTransferencia == null) {
        throw new AuraHandledException('A transferência não pode ser nula.');
    }

    Id recordTypeId = Schema.SObjectType.Transacao__c
        .getRecordTypeInfosByName()
        .get(novaTransferencia.Tipo__c)
        .getRecordTypeId();

    novaTransferencia.RecordTypeId = recordTypeId;

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


    public static  List<Transacao__c> getTransacoesPorUsuarioEData(String data) {
        List<String> partesData = data.split('-');
        Integer ano = Integer.valueOf(partesData[0]);
        Integer mes = Integer.valueOf(partesData[1]);
        Date dataInicio = Date.newInstance(ano, mes, 1);
        Date dataFim = dataInicio.addMonths(1).addDays(-1);
        return TransferenciaSelector.buscarTransferenciasPorUsuarioEData(dataInicio, dataFim);
    }
}