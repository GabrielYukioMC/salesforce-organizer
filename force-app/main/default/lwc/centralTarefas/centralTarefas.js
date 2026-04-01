import { LightningElement, track } from 'lwc';

export default class CentralTarefas extends LightningElement {

    @track abaCriar      = true;
    @track abaVer        = false;
    @track abaApontamentos = false;

    abrirCriar() {
        this.abaCriar      = true;
        this.abaVer        = false;
        this.abaApontamentos = false;
    }

    abrirVer() {
        this.abaCriar      = false;
        this.abaVer        = true;
        this.abaApontamentos = false;
    }

    abrirApontamentos() {
        this.abaCriar      = false;
        this.abaVer        = false;
        this.abaApontamentos = true;
    }

    get tabCriarClass() {
        return this.abaCriar ? 'tab active' : 'tab';
    }

    get tabVerClass() {
        return this.abaVer ? 'tab active' : 'tab';
    }

    get tabApontamentosClass() {
        return this.abaApontamentos ? 'tab active' : 'tab';
    }

    handleTarefaCriada() {
        this.abaCriar      = false;
        this.abaVer        = true;
        this.abaApontamentos = false;
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            const exibir = this.template.querySelector('c-exibir-tarefas-tab');
            if (exibir) exibir.refreshData();
        }, 0);
    }
}
