import { LightningElement, track } from 'lwc';

export default class CentralTarefas extends LightningElement {

    @track abaCriar = true;
    @track abaVer = false;

  
    abrirCriar() {
        this.abaCriar = true;
        this.abaVer = false;
    }

    abrirVer() {
        this.abaCriar = false;
        this.abaVer = true;
    }

    get tabCriarClass() {
        return this.abaCriar ? 'tab active' : 'tab';
    }

    get tabVerClass() {
        return this.abaVer ? 'tab active' : 'tab';
    }

    handleTarefaCriada() {
        // Muda para a aba "Ver" primeiro, depois aguarda o render para chamar refreshData
        this.abaCriar = false;
        this.abaVer = true;
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            const exibir = this.template.querySelector('c-exibir-tarefas-tab');
            if (exibir) exibir.refreshData();
        }, 0);
    }
}
