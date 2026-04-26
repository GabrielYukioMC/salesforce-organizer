import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import buscarRotinas from '@salesforce/apex/ApontamentoFixoController.buscarRotinas';
import salvarRotina  from '@salesforce/apex/ApontamentoFixoController.salvarRotina';
import deletarRotina from '@salesforce/apex/ApontamentoFixoController.deletarRotina';
import buscarProjetos from '@salesforce/apex/ProjetoController.buscarProjetos';

const DIAS_OPTIONS = [
    { label: 'Seg', value: 'Seg' },
    { label: 'Ter', value: 'Ter' },
    { label: 'Qua', value: 'Qua' },
    { label: 'Qui', value: 'Qui' },
    { label: 'Sex', value: 'Sex' }
];

export default class RotinasFixas extends LightningElement {
    @track rotinas    = [];
    @track carregando = false;
    @track salvando   = false;
    @track mostrarForm = false;
    @track rotinaEditando = {};
    @track projetos = [];

    diasOptions = DIAS_OPTIONS;
    _wiredResult;

    @wire(buscarRotinas)
    wiredRotinas(result) {
        this._wiredResult = result;
        if (result.data) {
            this.rotinas = result.data;
        }
    }

    @wire(buscarProjetos)
    wiredProjetos({ data }) {
        if (data) this.projetos = data;
    }

    get projetosOptions() {
        return [
            { label: '— Nenhum —', value: '' },
            ...this.projetos.map(p => ({ label: p.Name, value: p.Name }))
        ];
    }

    get semRotinas() {
        return !this.carregando && (!this.rotinas || this.rotinas.length === 0);
    }

    get diasSelecionados() {
        const val = this.rotinaEditando.DiaDaSemana__c;
        return val ? val.split(';') : [];
    }

    get perfilReadOnly() {
        return !!this.rotinaEditando.Projeto__c;
    }

    abrirNovaRotina() {
        this.rotinaEditando = {};
        this.mostrarForm = true;
    }

    editarRotina(event) {
        const id = event.currentTarget.dataset.id;
        const rotina = this.rotinas.find(r => r.Id === id);
        if (rotina) {
            this.rotinaEditando = { ...rotina };
            this.mostrarForm = true;
        }
    }

    cancelar() {
        this.rotinaEditando = {};
        this.mostrarForm = false;
    }

    handleFieldChange(event) {
        const campo = event.target.dataset.field;
        this.rotinaEditando = {
            ...this.rotinaEditando,
            [campo]: event.target.value
        };
    }

    handleProjetoChange(event) {
        const projetoNome = event.target.value;
        const projeto = this.projetos.find(p => p.Name === projetoNome);
        this.rotinaEditando = {
            ...this.rotinaEditando,
            Projeto__c: projetoNome || null,
            PerfilDeAlocacao__c: projeto ? projeto.Perfil_Alocacao__c : ''
        };
    }

    handleDiaChange(event) {
        this.rotinaEditando = {
            ...this.rotinaEditando,
            DiaDaSemana__c: event.detail.value.join(';')
        };
    }

    salvar() {
        if (!this._validar()) return;

        this.salvando = true;
        salvarRotina({ rotina: this.rotinaEditando })
            .then(() => {
                this._toast('Rotina salva com sucesso.', 'success');
                this.mostrarForm = false;
                this.rotinaEditando = {};
                return refreshApex(this._wiredResult);
            })
            .catch(err => {
                this._toast(err.body?.message || 'Erro ao salvar rotina.', 'error');
            })
            .finally(() => {
                this.salvando = false;
            });
    }

    excluirRotina(event) {
        const id = event.currentTarget.dataset.id;
        const rotina = this.rotinas.find(r => r.Id === id);
        const nome = rotina ? rotina.Name : 'esta rotina';

        // eslint-disable-next-line no-alert
        if (!confirm(`Excluir a rotina "${nome}"?`)) return;

        this.carregando = true;
        deletarRotina({ rotinaId: id })
            .then(() => {
                this._toast('Rotina excluída.', 'success');
                return refreshApex(this._wiredResult);
            })
            .catch(err => {
                this._toast(err.body?.message || 'Erro ao excluir rotina.', 'error');
            })
            .finally(() => {
                this.carregando = false;
            });
    }

    _validar() {
        const r = this.rotinaEditando;

        if (!r.Name || r.Name.trim() === '') {
            this._toast('Nome da rotina é obrigatório.', 'error');
            return false;
        }
        if (!r.DiaDaSemana__c || r.DiaDaSemana__c.trim() === '') {
            this._toast('Selecione ao menos um dia da semana.', 'error');
            return false;
        }
        if (!r.HoraInicio__c || !r.HoraFim__c) {
            this._toast('Hora de início e hora de fim são obrigatórias.', 'error');
            return false;
        }
        if (r.HoraFim__c <= r.HoraInicio__c) {
            this._toast('Hora de fim deve ser maior que hora de início.', 'error');
            return false;
        }
        return true;
    }

    _toast(message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title: variant === 'error' ? 'Erro' : 'Sucesso', message, variant }));
    }
}
