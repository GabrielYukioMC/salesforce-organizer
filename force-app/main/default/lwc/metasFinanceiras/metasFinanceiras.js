import { LightningElement, track } from 'lwc';
import buscarMetasDoUsuario from '@salesforce/apex/MetaController.buscarMetasDoUsuario';
import buscarMetaAtiva from '@salesforce/apex/MetaController.buscarMetaAtiva';
import criarMeta from '@salesforce/apex/MetaController.criarMeta';
import atualizarMeta from '@salesforce/apex/MetaController.atualizarMeta';
import deletarMeta from '@salesforce/apex/MetaController.deletarMeta';
import ativarMeta from '@salesforce/apex/MetaController.ativarMeta';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

const META_CAD_PADRAO = {
    Name: '',
    GastosFixos__c: 30,
    ReservaEmergencia__c: 10,
    Investimentos__c: 20,
    QualidadeDeVida__c: 20,
    DesenvolvimentoPessoal__c: 10,
    Objetivos__c: 10,
    Ativa__c: true,
    Descricao__c: ''
};

export default class MetasFinanceiras extends LightningElement {

    @track metaAtiva = null;
    @track listaMetas = [];
    @track exibeListaMetas = false;
    @track exibeModal = false;
    @track modoEdicao = false;
    @track metaCad = { ...META_CAD_PADRAO };

    connectedCallback() {
        this.carregarDados();
    }

    carregarDados() {
        buscarMetaAtiva()
            .then(meta => { this.metaAtiva = meta; })
            .catch(error => { console.error('Erro ao buscar meta ativa:', error); });

        buscarMetasDoUsuario()
            .then(metas => { this.listaMetas = metas; })
            .catch(error => { console.error('Erro ao buscar metas:', error); });
    }

    get temMetaAtiva() {
        return this.metaAtiva != null;
    }

    get categoriasBarra() {
        if (!this.metaAtiva) return [];
        return [
            { key: 'gf',  nome: 'Gastos Fixos',           percentual: this.metaAtiva.GastosFixos__c,           cssWidth: 'width:' + this.metaAtiva.GastosFixos__c + '%' },
            { key: 're',  nome: 'Reserva de Emergência',   percentual: this.metaAtiva.ReservaEmergencia__c,      cssWidth: 'width:' + this.metaAtiva.ReservaEmergencia__c + '%' },
            { key: 'inv', nome: 'Investimentos',            percentual: this.metaAtiva.Investimentos__c,          cssWidth: 'width:' + this.metaAtiva.Investimentos__c + '%' },
            { key: 'qv',  nome: 'Qualidade de Vida',        percentual: this.metaAtiva.QualidadeDeVida__c,        cssWidth: 'width:' + this.metaAtiva.QualidadeDeVida__c + '%' },
            { key: 'dp',  nome: 'Desenvolvimento Pessoal',  percentual: this.metaAtiva.DesenvolvimentoPessoal__c, cssWidth: 'width:' + this.metaAtiva.DesenvolvimentoPessoal__c + '%' },
            { key: 'obj', nome: 'Objetivos',               percentual: this.metaAtiva.Objetivos__c,              cssWidth: 'width:' + this.metaAtiva.Objetivos__c + '%' }
        ];
    }

    get somaTotalPercentuais() {
        const gf  = Number(this.metaCad.GastosFixos__c)           || 0;
        const re  = Number(this.metaCad.ReservaEmergencia__c)      || 0;
        const inv = Number(this.metaCad.Investimentos__c)          || 0;
        const qv  = Number(this.metaCad.QualidadeDeVida__c)        || 0;
        const dp  = Number(this.metaCad.DesenvolvimentoPessoal__c) || 0;
        const obj = Number(this.metaCad.Objetivos__c)              || 0;
        return Math.round((gf + re + inv + qv + dp + obj) * 100) / 100;
    }

    get somaValida() {
        return this.somaTotalPercentuais === 100;
    }

    get somaInvalida() {
        return !this.somaValida;
    }

    get iconeToggleLista() {
        return this.exibeListaMetas ? 'utility:chevronup' : 'utility:chevrondown';
    }

    get classeSomaTotal() {
        return this.somaValida ? 'soma-total soma-valida' : 'soma-total soma-invalida';
    }

    get tituloModal() {
        return this.modoEdicao ? 'Editar Meta' : 'Nova Meta';
    }

    handleToggleListaMetas() {
        this.exibeListaMetas = !this.exibeListaMetas;
    }

    handleAbrirModalNova() {
        this.modoEdicao = false;
        this.metaCad = { ...META_CAD_PADRAO };
        this.exibeModal = true;
    }

    handleAbrirModalEditar(event) {
        const metaId = event.currentTarget.dataset.id;
        const meta = this.listaMetas.find(m => m.Id === metaId);
        if (!meta) return;
        this.modoEdicao = true;
        this.metaCad = {
            Id:                       meta.Id,
            Name:                     meta.Name,
            GastosFixos__c:           meta.GastosFixos__c,
            ReservaEmergencia__c:     meta.ReservaEmergencia__c,
            Investimentos__c:         meta.Investimentos__c,
            QualidadeDeVida__c:       meta.QualidadeDeVida__c,
            DesenvolvimentoPessoal__c: meta.DesenvolvimentoPessoal__c,
            Objetivos__c:             meta.Objetivos__c,
            Ativa__c:                 meta.Ativa__c,
            Descricao__c:             meta.Descricao__c || ''
        };
        this.exibeModal = true;
    }

    handleAbrirModalEditarAtiva() {
        if (!this.metaAtiva) return;
        this.modoEdicao = true;
        this.metaCad = {
            Id:                       this.metaAtiva.Id,
            Name:                     this.metaAtiva.Name,
            GastosFixos__c:           this.metaAtiva.GastosFixos__c,
            ReservaEmergencia__c:     this.metaAtiva.ReservaEmergencia__c,
            Investimentos__c:         this.metaAtiva.Investimentos__c,
            QualidadeDeVida__c:       this.metaAtiva.QualidadeDeVida__c,
            DesenvolvimentoPessoal__c: this.metaAtiva.DesenvolvimentoPessoal__c,
            Objetivos__c:             this.metaAtiva.Objetivos__c,
            Ativa__c:                 this.metaAtiva.Ativa__c,
            Descricao__c:             this.metaAtiva.Descricao__c || ''
        };
        this.exibeModal = true;
    }

    handleFecharModal() {
        this.exibeModal = false;
        this.metaCad = { ...META_CAD_PADRAO };
    }

    handleChange(event) {
        const field = event.target.dataset.field;
        const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        this.metaCad = { ...this.metaCad, [field]: value };
    }

    handleDistribuirIgualmente() {
        const base = Math.floor(100 / 6 * 100) / 100;
        const resto = Math.round((100 - base * 6) * 100) / 100;
        this.metaCad = {
            ...this.metaCad,
            GastosFixos__c:           base + resto,
            ReservaEmergencia__c:     base,
            Investimentos__c:         base,
            QualidadeDeVida__c:       base,
            DesenvolvimentoPessoal__c: base,
            Objetivos__c:             base
        };
    }

    handleSalvar() {
        if (!this.somaValida) {
            this.showToast('Atenção', 'A soma dos percentuais deve ser exatamente 100%. Total atual: ' + this.somaTotalPercentuais + '%', 'warning');
            return;
        }

        const acao = this.modoEdicao
            ? atualizarMeta({ meta: this.metaCad })
            : criarMeta({ novaMeta: this.metaCad });

        acao
            .then(() => {
                this.showToast('Sucesso', 'Meta salva com sucesso!', 'success');
                this.handleFecharModal();
                this.carregarDados();
            })
            .catch(error => {
                const msg = error?.body?.message || 'Erro ao salvar a meta.';
                this.showToast('Erro', msg, 'error');
            });
    }

    handleAtivar(event) {
        const metaId = event.currentTarget.dataset.id;
        ativarMeta({ metaId })
            .then(() => {
                this.showToast('Sucesso', 'Meta ativada com sucesso!', 'success');
                this.carregarDados();
            })
            .catch(error => {
                const msg = error?.body?.message || 'Erro ao ativar a meta.';
                this.showToast('Erro', msg, 'error');
            });
    }

    handleDeletar(event) {
        const metaId = event.currentTarget.dataset.id;
        deletarMeta({ metaId })
            .then(() => {
                this.showToast('Sucesso', 'Meta excluída.', 'success');
                this.carregarDados();
            })
            .catch(error => {
                const msg = error?.body?.message || 'Erro ao excluir a meta.';
                this.showToast('Erro', msg, 'error');
            });
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
