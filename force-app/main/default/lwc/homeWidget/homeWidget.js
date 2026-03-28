import { LightningElement, wire, track } from 'lwc';
import buscarMinhasTarefas from '@salesforce/apex/TarefaController.buscarTarefasPorUsuarioKanban';
import getTransacoesPorUsuarioEData from '@salesforce/apex/TransferenciaController.getTransacoesPorUsuarioEData';
import buscarMetaAtiva from '@salesforce/apex/MetaController.buscarMetaAtiva';

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const CATEGORIA_LABELS = {
    GastosFixos__c: 'Gastos Fixos',
    ReservaEmergencia__c: 'Reserva Emergência',
    Investimentos__c: 'Investimentos',
    QualidadeDeVida__c: 'Qualidade de Vida',
    DesenvolvimentoPessoal__c: 'Desenvolvimento Pessoal',
    Objetivos__c: 'Objetivos'
};

export default class HomeWidget extends LightningElement {
    @track tarefasHoje = [];
    @track entradasHoje = [];
    @track saidasHoje = [];
    @track metaAtiva = null;

    _mesAtual = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();

    _diaHoje = new Date().getDate();

    @wire(buscarMinhasTarefas)
    wiredTarefas({ data }) {
        if (!data) return;
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const amanha = new Date(hoje);
        amanha.setDate(hoje.getDate() + 1);
        this.tarefasHoje = data.filter(t => {
            if (!t.CloseDate__c) return false;
            const d = new Date(t.CloseDate__c);
            return d >= hoje && d < amanha;
        });
    }

    @wire(getTransacoesPorUsuarioEData, { data: '$_mesAtual' })
    wiredTransacoes({ data }) {
        if (!data) return;
        const hoje = this._diaHoje;
        const doDia = data.filter(t => {
            const d = new Date(t.Data__c);
            return d.getDate() === hoje;
        });
        this.entradasHoje = doDia.filter(t => t.Tipo__c === 'Entrada').map(t => ({
            ...t, valorFmt: fmt.format(t.Valor__c)
        }));
        this.saidasHoje = doDia.filter(t => t.Tipo__c === 'Saída').map(t => ({
            ...t, valorFmt: fmt.format(t.Valor__c)
        }));
    }

    @wire(buscarMetaAtiva)
    wiredMeta({ data }) {
        if (!data) return;
        this.metaAtiva = data;
    }

    get semTarefasHoje() { return this.tarefasHoje.length === 0; }
    get semMovimentacoesHoje() { return this.entradasHoje.length === 0 && this.saidasHoje.length === 0; }
    get temMeta() { return !!this.metaAtiva; }

    get categoriasMeta() {
        if (!this.metaAtiva) return [];
        return Object.keys(CATEGORIA_LABELS).map(campo => ({
            key: campo,
            nome: CATEGORIA_LABELS[campo],
            percentual: this.metaAtiva[campo] || 0
        }));
    }
}
