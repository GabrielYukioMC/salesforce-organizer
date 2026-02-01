import { LightningElement , track} from 'lwc';


export default class ExibirTarefasTab extends LightningElement {

      @track tasks = [];

    @track novaTask = {
        nome: '',
        prioridade: '',
        tipo: '',
        prazo: ''
    };
}