import { LightningElement } from 'lwc';

export default class OrcamentoMensal extends LightningElement {

    // =============================
    // CONTROLE DE MÊS
    // =============================
    mesReferencia = '2026-02';

    handleMesChange(event) {
        this.mesReferencia = event.target.value;
        this.carregarDadosDoMes();
    }

    carregarDadosDoMes() {
        console.log('Carregando dados do mês:', this.mesReferencia);

        /**
         * FUTURO:
         * Apex:
         * getOrcamento({ mesReferencia: this.mesReferencia })
         */
    }

    // =============================
    // DADOS MOCK (temporários)
    // =============================
    saldoDisponivel = '5.200,00';
    totalCartoes = '3.500,00';
    contasPagar = '2.000,00';
    investimentos = '10.000,00';
    saldoFinal = '9.700,00';

    metas = [
        { id: 1, nome: 'Custos fixos', percent: '58%', width: 'width:58%' },
        { id: 2, nome: 'Metas', percent: '0%', width: 'width:5%' },
        { id: 3, nome: 'Prazeres', percent: '0%', width: 'width:2%' }
    ];

    entradas = [
        { id: 1, nome: 'Salário', valor: '+R$ 7.282,00' }
    ];

    saidas = [
        { id: 1, nome: 'Aluguel', valor: '-R$ 1.500,00' },
        { id: 2, nome: 'Internet', valor: '-R$ 120,00' }
    ];

    parcelas = [
        { id: 1, nome: 'Celular', info: '3/12 parcelas' },
        { id: 2, nome: 'Notebook', info: '8/10 parcelas' }
    ];


    movimentacoesFixas = {
    salario: null,
    luz: null,
    agua: null
};

mesSelecionado = {
    mes: 2,
    ano: 2026
};


handleAdicionarMovimentacoes(event) {
    const novasMovimentacoes = event.detail;

    // aqui você:
    // - adiciona na lista do mês
    // - recalcula saldo
    // - futuramente salva via Apex
}



aplicarFixosAoMes(mesReferencia) {
    return this.fixos
        .filter(f => {
            if (f.recorrencia === 'TODOS') return true;
            return f.mesInicio <= mesReferencia;
        })
        .map(f => ({
            descricao: f.descricao,
            valor: f.tipo === 'SAIDA' ? -f.valor : f.valor,
            mes: mesReferencia,
            origem: 'FIXO'
        }));
}

}

