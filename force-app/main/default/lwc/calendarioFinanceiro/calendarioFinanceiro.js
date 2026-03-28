import { LightningElement, api, track } from 'lwc';
import getTransacoesPorUsuarioEData from '@salesforce/apex/TransferenciaController.getTransacoesPorUsuarioEData';
import realizarTransferencia from '@salesforce/apex/TransferenciaController.realizarTransferencia';
import deletarTransacao from '@salesforce/apex/TransferenciaController.deletarTransacao';
import atualizarTransacao from '@salesforce/apex/TransferenciaController.atualizarTransacao';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CalendarioFinanceiro extends LightningElement {

    @api mesReferencia;   
    @track diasDoMes = [];
    @track totalEntradas = 0;
    @track totalSaidas = 0;
    diasSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    @track modalAberto = false;
    @track diaSelecionado;
    @track modalEdicaoAberto = false;
    @track transacaoEditando = {};
    @track salvandoEdicao = false;


    @track saidaCad = {
    tipoTransacao: 'Saída',
    nomeSaida: '',
    valor: 0,
    valorFormatado: 'R$ 0,00',
    tipoSaida: '',
    diaescolhido: null,
    recorrente: false,
    frequencia: 'Mensal'
};

get opcoesFrequencia() {
    return [
        { label: 'Mensal', value: 'Mensal' },
        { label: 'Semestral', value: 'Semestral' },
        { label: 'Anual', value: 'Anual' }
    ];
}

    tiposEntrada = [
        { label: 'Salário', value: 'Salario' },
        { label: 'Dividendos', value: 'Renda Passiva' },
        { label: 'Extra', value: 'Renda Extra' }
    ];

    tiposSaida = [
        { label: 'Fixa', value: 'Fixa' },
        { label: 'Reserva de Emergencia', value: 'Reserva de Emergencia' },
        { label: 'Economia', value: 'Economia' },
        { label: 'Investimento', value: 'Investimento' },
        { label: 'Aluguel', value: 'Aluguel' },
        { label: 'Cartão de crédito', value: 'Cartão de credito' },
        { label: 'Diario', value: 'Diario' },
        { label: 'Mercado', value: 'Mercado' },
        { label: 'Conforto', value: 'Conforto' },
        { label: 'Objetivos', value: 'Objetivos' },
        { label: 'Prazeres', value: 'Prazeres' },
        { label: 'Liberdade financeira', value: 'Liberdade financeira' },
        { label: 'Conhecimento', value: 'Conhecimento' }
    ];


get opcoesCategoria() {
    return this.saidaCad.tipoTransacao === 'Entrada'
        ? this.tiposEntrada
        : this.tiposSaida;
}

get opcoesTipo() {
    return [
        { label: 'Entrada', value: 'Entrada' },
        { label: 'Saída', value: 'Saída' }
    ];
}

    connectedCallback() {
        this.pegarMesAtual();
    }

    pegarMesAtual() {
        const dataAtual = new Date();
        const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
        const ano = dataAtual.getFullYear();
        this.mesReferencia = `${ano}-${mes}`;
        this.buscarTransacoes();
    }

    get mesSelecionado(){
        const [ano, mes] = this.mesReferencia.split('-');
        const data = new Date(ano, mes - 1);
        return data.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    }

    get getDiasDoMes(){
        return this.diasDoMes;
    }
    get totalEntradasFormatado() {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(this.totalEntradas);
}

get totalSaidasFormatado() {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(this.totalSaidas);
}

get saldo() {
    return this.totalEntradas - this.totalSaidas;
}

get saldoFormatado() {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(this.saldo);
}

get classeSaldo() {
    return this.saldo >= 0
        ? 'card-resumo saldo-positivo'
        : 'card-resumo saldo-negativo';
}

    mesAnterior() {
        const [ano, mes] = this.mesReferencia.split('-');
        const data = new Date(ano, mes - 1);
        data.setMonth(data.getMonth() - 1);

        const novoMes = String(data.getMonth() + 1).padStart(2, '0');
        this.mesReferencia = `${data.getFullYear()}-${novoMes}`;

        this.buscarTransacoes();
    }

    proximoMes() {
        const [ano, mes] = this.mesReferencia.split('-');
        const data = new Date(ano, mes - 1);
        data.setMonth(data.getMonth() + 1);

        const novoMes = String(data.getMonth() + 1).padStart(2, '0');
        this.mesReferencia = `${data.getFullYear()}-${novoMes}`;

        this.buscarTransacoes();
    }

   buscarTransacoes() {

    getTransacoesPorUsuarioEData({ data: this.mesReferencia })
    .then(transacoes => {

        console.log('transacoes: ', transacoes);
        

        this.calcularResumo(transacoes);

        const mapa = this.agruparPorDia(transacoes);
        console.log('mapa', mapa);
        
        this.gerarCalendario(mapa);

    })
    .catch(error => {
        console.error(error);
        this.dispatchEvent(new ShowToastEvent({
            title: 'Erro',
            message: error?.body?.message || 'Ocorreu um erro ao salvar a transação.',
            variant: 'error'
        }));
    });
}

calcularResumo(lista) {

    this.totalEntradas = 0;
    this.totalSaidas = 0;

    lista.forEach(i => {
        if (i.Tipo__c === 'Entrada') {
            this.totalEntradas += i.Valor__c;
        } else {
            this.totalSaidas += i.Valor__c;
        }
    });
}

    agruparPorDia(lista) {

        const mapa = {};

        lista.forEach(i => {

            const data = new Date(i.Data__c);
            const dia = data.getDate();

            if(!mapa[dia]) mapa[dia] = [];

            mapa[dia].push({
                ...i,
                valorFormatado: 
                    (i.Tipo__c === 'Entrada' ? '+' : '-') +
                    new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                    }).format(i.Valor__c),

                cssClass:
                    i.Tipo__c === 'Entrada'
                    ? 'entrada'
                    : 'saida'
            });
        });

        return mapa;
    }

    gerarCalendario(mapa) {

        const [ano, mes] = this.mesReferencia.split('-');

        const primeiroDia = new Date(ano, mes - 1, 1);
        const ultimoDia = new Date(ano, mes, 0);

        const dias = [];

        for(let i = 0; i < primeiroDia.getDay(); i++){
            dias.push({ key: 'empty-'+i });
        }

        const hoje = new Date();
        const ehMesAtual =
            hoje.getFullYear() == ano &&
            hoje.getMonth() == mes - 1;

        for(let d = 1; d <= ultimoDia.getDate(); d++){
            const ehHoje = ehMesAtual && hoje.getDate() === d;

            dias.push({
                key: d,
                numero: d,
                transacoes: mapa[d] || null,
                cssClass: ehHoje
                    ? 'numero-dia hoje'
                    : 'numero-dia'
            });
        }

        this.diasDoMes = dias;
    }


    salvarTransacao() {

    const [ano, mes] = this.mesReferencia.split('-');
    const data = new Date(Number(ano), Number(mes) - 1, Number(this.saidaCad.diaescolhido));

    // const frequencia = this.saidaCad.recorrente ? this.saidaCad.frequencia : 'Única';

   const novaTransacao = {
    Name : this.saidaCad.nomeSaida,
    Tipo__c : this.saidaCad.tipoTransacao,
    Valor__c : this.saidaCad.valor,
    Categoria__c : this.saidaCad.tipoSaida,
    Data__c : data,
    Recorrente__c : this.saidaCad.recorrente,
    Frequencia__c : this.saidaCad.recorrente ? this.saidaCad.frequencia : null
};

realizarTransferencia({ novaTransferencia: novaTransacao })
.then(() => {
        // this.diasDoMes = [];

    this.dispatchEvent(new ShowToastEvent({
        title: 'Sucesso',
        message: 'Transação salva com sucesso!',
        variant: 'success'
    }));
    setTimeout(() => {

    this.fecharModal();

        this.buscarTransacoes();
    }, 200);

})
}

    handleToggle(event) {

        let obj = { ...this.saidaCad };

        obj.recorrente = event.target.checked;

        this.saidaCad = obj;
    }

    handleChange(event) {

        const field = event.target.dataset.field;
        let value = event.target.value;

        let obj = { ...this.saidaCad };

        if (field === 'valorFormatado') {

            const valores = this.obterValor(value);

            obj.valor = valores.valor;
            obj.valorFormatado = valores.valorFormatado;

            event.target.value = valores.valorFormatado;
        }
        else {
            obj[field] = value;

            if (field === 'tipoTransacao') {
                obj.tipoSaida = null;
            }
        }

        this.saidaCad = obj;
    }
    fecharModal() {
        this.modalAberto = false;

        this.saidaCad = {
            tipoTransacao: 'Saída',
            nomeSaida: '',
            valor: 0,
            valorFormatado: 'R$ 0,00',
            tipoSaida: '',
            diaescolhido: null,
            recorrente: false,
            frequencia: 'Mensal'
        };
    }

    abrirModal(event) {
        const dia = event.currentTarget.dataset.dia;
        if(!dia) return;
        this.diaSelecionado = dia;
        this.saidaCad.diaescolhido = dia;
        this.modalAberto = true;
    }

    handleAbrirEdicao(event) {
        event.stopPropagation();
        const transacaoId = event.currentTarget.dataset.id;
        let transacaoEncontrada = null;
        for (const dia of this.diasDoMes) {
            if (dia.transacoes) {
                transacaoEncontrada = dia.transacoes.find(t => t.Id === transacaoId);
                if (transacaoEncontrada) break;
            }
        }
        if (transacaoEncontrada) {
            this.transacaoEditando = { ...transacaoEncontrada };
            this.modalEdicaoAberto = true;
        }
    }

    fecharModalEdicao() {
        this.modalEdicaoAberto = false;
        this.transacaoEditando = {};
    }

    handleChangeEdicao(event) {
        const field = event.target.dataset.field;
        this.transacaoEditando = { ...this.transacaoEditando, [field]: event.target.value };
    }

    handleChangeEdicaoPago(event) {
        this.transacaoEditando = { ...this.transacaoEditando, Pago__c: event.target.checked };
    }

    handleSalvarEdicao() {
        this.salvandoEdicao = true;
        const payload = {
            Id: this.transacaoEditando.Id,
            Name: this.transacaoEditando.Name,
            Tipo__c: this.transacaoEditando.Tipo__c,
            Categoria__c: this.transacaoEditando.Categoria__c,
            Valor__c: this.transacaoEditando.Valor__c,
            Data__c: this.transacaoEditando.Data__c,
            Pago__c: this.transacaoEditando.Pago__c
        };
        atualizarTransacao({ transacao: payload })
            .then(() => {
                this._toast('Sucesso', 'Transação atualizada!', 'success');
                this.fecharModalEdicao();
                this.buscarTransacoes();
            })
            .catch(err => { this._toast('Erro', err?.body?.message || 'Erro ao salvar.', 'error'); })
            .finally(() => { this.salvandoEdicao = false; });
    }

    handleDeletar(event) {
        event.stopPropagation();
        const transacaoId = event.currentTarget.dataset.id;
        deletarTransacao({ transacaoId })
            .then(() => {
                this._toast('Sucesso', 'Transação excluída.', 'success');
                this.buscarTransacoes();
            })
            .catch(err => { this._toast('Erro', err?.body?.message || 'Erro ao excluir.', 'error'); });
    }

    handleTogglePago(event) {
        event.stopPropagation();
        const transacaoId = event.currentTarget.dataset.id;
        const pago = event.target.checked;
        atualizarTransacao({ transacao: { Id: transacaoId, Pago__c: pago } })
            .then(() => { this.buscarTransacoes(); })
            .catch(err => { this._toast('Erro', err?.body?.message || 'Erro ao atualizar.', 'error'); });
    }

    _toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }


    obterValor(valor) {

        valor = valor.replace(/\D/g, '');
        valor = valor.replace(/^0+/, '');

        if (!valor || valor.length === 0) {
            return {
                valorFormatado: 'R$ 0,00',
                valor: 0
            };
        }

        let numero = Number(valor) / 100;

        const formatado = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(numero);

        return {
            valorFormatado: formatado,
            valor: numero
        };
    }
}