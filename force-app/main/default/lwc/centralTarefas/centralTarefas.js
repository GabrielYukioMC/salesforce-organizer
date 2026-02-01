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

   
}
