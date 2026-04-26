import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import criarTarefa    from '@salesforce/apex/TarefaController.criarTarefa';
import buscarProjetos from '@salesforce/apex/ProjetoController.buscarProjetos';

export default class CriarTarefasTab extends LightningElement {

    @track tasks    = [];
    @track projetos = [];

    @wire(buscarProjetos)
    wiredProjetos({ data }) {
        if (data) this.projetos = data;
    }

    get projetosOptions() {
        return this.projetos.map(p => ({ label: p.Name, value: p.Id }));
    }

    get isTipoTrabalho() {
        return this.novaTask.TipoTarefa__c === 'Trabalho';
    }

    @track novaTask = {
        Name: '',
        Prioridade__c: '',
        TipoTarefa__c: 'Outros',
        Status__c: 'Não iniciado',
        CloseDate__c: '',
        Descricao__c: '',
        Recorrente__c: false,
        FrequenciaTarefa__c: 'Semanal'
    };

    opcoesFrequencia = [
        { label: 'Semanal', value: 'Semanal' },
        { label: 'Quinzenal', value: 'Quinzenal' },
        { label: 'Mensal', value: 'Mensal' }
    ];

    prioridades = [
        { label: 'Alta', value: 'Alta' },
        { label: 'Média', value: 'Média' },
        { label: 'Baixa', value: 'Baixa' }
    ];

    tipos = [
        { label: 'Trabalho', value: 'Trabalho' },
        { label: 'Estudos', value: 'Estudos' },
        { label: 'Pessoal', value: 'Pessoal' },
        { label: 'Outros', value: 'Outros' }
    ];

    statusOptions = [
        { label: 'Não Iniciado', value: 'Não iniciado' },
        { label: 'Em andamento', value: 'Em andamento' },
        { label: 'Concluído', value: 'Concluído' },
        { label: 'Em espera', value: 'Em espera' },
        { label: 'Cancelado', value: 'Cancelado' }
    ];

    formatosPermitidos = [
    'bold',
    'italic',
    'underline',
    'strike',
    'list',
    'indent',
    'align',
    'link',
    'clean',
    'font',
    'size',
    'color'
];


     prazoMensagem;
    prazoClasse;

    handleToggleRecorrente(event) {
        this.novaTask = { ...this.novaTask, Recorrente__c: event.target.checked };
    }

     handleChange(event) {
        const field = event.target.dataset.field;
        console.log(field);
        console.log('valor: ', event.target.value);
        
        
        const novaTask = { ...this.novaTask, [field]: event.target.value };

        // Ao mudar tipo para não-Trabalho, limpa o projeto
        if (field === 'TipoTarefa__c' && event.target.value !== 'Trabalho') {
            novaTask.Projeto__c = null;
        }

        this.novaTask = novaTask;

        if (field === 'CloseDate__c') {
            this.calcularPrazo();
        }
    }

    calcularPrazo() {
        if (!this.novaTask.CloseDate__c) {
            this.prazoMensagem = null;
            return;
        }

        const agora = new Date();
        const prazo = new Date(this.novaTask.CloseDate__c);

        const diffMs = prazo - agora;
        const diffHoras = Math.ceil(diffMs / (1000 * 60 * 60));
        const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffMs < 0) {
            this.prazoMensagem = ' O prazo desta tarefa já expirou.';
            this.prazoClasse = 'prazo-info prazo-atrasado';
            return;
        }

        if (diffHoras < 24) {
            this.prazoMensagem = ` O prazo da tarefa está prevista para daqui a ${diffHoras} horas.`;
            this.prazoClasse = 'prazo-info prazo-hoje';
            return;
        }

        this.prazoMensagem = ` O prazo da tarefa está prevista para daqui a ${diffDias} dias.`;
        this.prazoClasse = 'prazo-info prazo-ok';
    }

  criarTask() {
    if (!this.novaTask.Name || !this.novaTask.Name.trim()) {
        this.showToast('Campo obrigatório', 'Informe o Nome da Task.', 'error');
        return;
    }
    if (!this.novaTask.Prioridade__c) {
        this.showToast('Campo obrigatório', 'Selecione a Prioridade.', 'error');
        return;
    }

    criarTarefa({ novaTarefa: this.novaTask })
        .then(() => {
            this.showToast(
                'Sucesso',
                'Tarefa criada com sucesso!',
                'success'
            );

            this.limparFormulario();
            this.dispatchEvent(new CustomEvent('tarefacriada', { bubbles: true, composed: true }));
        })
        .catch(error => {
            console.error('Erro ao criar tarefa: ', error);

            const mensagemErro =
                error?.body?.message || 'Erro inesperado ao criar a tarefa.';

            this.showToast(
                'Erro',
                mensagemErro,
                'error'
            );
        });
}



    limparFormulario() {
        this.novaTask = {
            Name: '',
            Prioridade__c: '',
            TipoTarefa__c: 'Outros',
            Status__c: 'Não iniciado',
            CloseDate__c: '',
            Descricao__c: '',
            Recorrente__c: false,
            FrequenciaTarefa__c: 'Semanal',
            Projeto__c: null
        };
        this.prazoMensagem = null;
    }

    showToast(title, message, variant) {
    this.dispatchEvent(
        new ShowToastEvent({
            title,
            message,
            variant
        })
    );
}

}
