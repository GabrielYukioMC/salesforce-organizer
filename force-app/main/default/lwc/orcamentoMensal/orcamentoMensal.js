import { LightningElement } from 'lwc';
import realizarTransferencia from '@salesforce/apex/TransferenciaController.realizarTransferencia';
import getTransacoesPorUsuarioEData from '@salesforce/apex/TransferenciaController.getTransacoesPorUsuarioEData';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import chartjs from '@salesforce/resourceUrl/chart';
import { loadScript } from 'lightning/platformResourceLoader';

export default class OrcamentoMensal extends LightningElement {

    mesReferencia = null;

    exibeModalEntrada = false;
    exibeModalSaida = false;
entradaCad = {
    nomeEntrada: '',
    tipoEntrada: '',
    valorEntrada: 0,
    valorFormatado: 'R$ 0,00',
    diaEntrada: '1',
    recorrente: false,
    frequencia: 'Mensal'
};

saidaCad = {
    nomeSaida: '',
    tipoSaida: '',
    valorSaida: 0,
    valorFormatado: 'R$ 0,00',
    diaSaida: '1',
    recorrente: false,
    frequencia: 'Mensal'
};
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

    listaEntradas = [];
    listaSaidas = [];
    listaTransacoes = [];


    get listaDias() {
        if (!this.mesReferencia) return [];

        const [ano, mes] = this.mesReferencia.split('-');

        const ultimoDia = new Date(ano, mes, 0).getDate();

        let dias = [];
        for (let i = 1; i <= ultimoDia; i++) {
            dias.push({
                label: `${i}`,
                value:  `${i}`
            });
        }

        return dias;
    }


    get mesSelecionado(){
        const [ano, mes] = this.mesReferencia.split('-');
        const data = new Date(ano, mes - 1);
        return data.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    }

    get opcoesFrequencia() {
    return [
        { label: 'Mensal', value: 'Mensal' },
        { label: 'Semestral', value: 'Semestral' },
        { label: 'Anual', value: 'Anual' }
    ];
}

    get valorTotalEntradas() { return this.listaEntradas.reduce((total, entrada) => total + entrada.Valor__c, 0); }

    get valorTotalSaidas() {  return this.listaSaidas.reduce((total, saida) => total + saida.Valor__c, 0);  }

    get valorDisponivel() {  return this.valorTotalEntradas - this.valorTotalSaidas; }

    get valorDisponivelFormatado() { return this.formatarValor(this.valorDisponivel);}

    get valorTotalEntradasFormatado() {return this.formatarValor(this.valorTotalEntradas);}

    get valorTotalSaidasFormatado() {return this.formatarValor(this.valorTotalSaidas);}


 

    connectedCallback() {
       this.pegarMesAtual();
    }
    chartInicializado = false;

    renderedCallback() {
        if (this.chartInicializado) return;
        this.chartInicializado = true;

        loadScript(this, chartjs)
            .then(() => {
                this.desenharGraficos();
            })
            .catch(e => console.error(e));
    }


    handleMesChange(event) {
        this.mesReferencia = event.target.value;
        this.getTransacoesPorUsuarioEData();
        }

    pegarMesAtual() {
        const dataAtual = new Date();
        const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
        const ano = dataAtual.getFullYear();
        this.mesReferencia = `${ano}-${mes}`;
        console.log('mes referencia: ', this.mesReferencia);
        this.getTransacoesPorUsuarioEData();
    }

    handleAbrirModalEntrada() {
        this.exibeModalEntrada = true;
    }

    handleAbrirModalSaida() {
        this.exibeModalSaida = true;
    }

    handleFecharModal() {
        this.exibeModalEntrada = false;
        this.exibeModalSaida = false;


        this.entradaCad = {
            nomeEntrada: '',
            tipoEntrada: '',
            valorEntrada: 0,
            valorFormatado: 'R$ 0,00',
            diaEntrada: '1'
        };

        this.saidaCad = {
            nomeSaida: '',
            tipoSaida: '',
            valorSaida: 0,
            valorFormatado: 'R$ 0,00',
            diaSaida: '1'
        };
    }


   handleChange(event) {
        const field = event.target.dataset.field;
        const tipo = event.target.dataset.tipo;  
        const value = event.target.value;

        let obj = tipo === 'saida' ? this.saidaCad : this.entradaCad;

        if (field === 'valorFormatado') {
            const valores = this.obterValor(value);

            obj = {
                ...obj,
                valorEntrada: valores.valor,
                valorSaida: valores.valor,
                valorFormatado: valores.valorFormatado
            };

            event.target.value = valores.valorFormatado;
        } else {
            obj = {
                ...obj,
                [field]: value
            };
        }

        if (tipo === 'saida') {
            this.saidaCad = obj;
        } else {
            this.entradaCad = obj;
        }
    }

    obterValor(valor) {
        valor = valor.replace(/\D/g, '');
        valor = valor.replace(/^0+/, '');
        console.log('valor:', valor);   

        if (valor === '' || valor.length == 0) {
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


    handleSalvarEntrada() {
        console.log('Entrada cadastrada:' +JSON.stringify(this.entradaCad));

        let data = new Date();
        data.setFullYear(this.mesReferencia.split('-')[0]);
        data.setMonth(this.mesReferencia.split('-')[1] - 1);
        data.setDate(this.entradaCad.diaEntrada  );

        let obj = {
            Name : this.entradaCad.nomeEntrada,
            Tipo__c :'Entrada',
            Valor__c : this.entradaCad.valorEntrada,
            Categoria__c : this.entradaCad.tipoEntrada,
            Data__c : data,
            Recorrente__c : this.entradaCad.recorrente,
            Frequencia__c : this.entradaCad.recorrente ? this.entradaCad.frequencia : null
        };

        console.log('obj entrada a ser enviado ao servidor: ' + JSON.stringify(obj));
        this.executarTransacao(obj);
    }

    handleSalvarSaida() {
        console.log('Saída cadastrada:' +JSON.stringify(this.saidaCad));

        let data = new Date();
        data.setFullYear(this.mesReferencia.split('-')[0]);
        data.setMonth(this.mesReferencia.split('-')[1] - 1);
        data.setDate(this.saidaCad.diaSaida  );

        let obj = {
            Name : this.saidaCad.nomeSaida,
            Tipo__c :'Saída',
            Valor__c : this.saidaCad.valorSaida,
            Categoria__c : this.saidaCad.tipoSaida,
            Data__c : data,
            Recorrente__c : this.saidaCad.recorrente,
            Frequencia__c : this.saidaCad.recorrente ? this.saidaCad.frequencia : null
        };

        console.log('obj saída a ser enviado ao servidor: ' + JSON.stringify(obj));
        this.executarTransacao(obj);
    }

    executarTransacao(novaTransacao) {

        if (!novaTransacao) {
            console.error('Dados da transação estão incompletos.');
            this.showToast('Erro', 'Dados da transação estão incompletos.', 'error');
            return;
        }

        if (novaTransacao.Valor__c < 0) {

            console.error('Valor da transação não pode ser negativo.');
            this.showToast('Erro', 'Valor da transação não pode ser negativo.', 'error');
            return;
        }



    realizarTransferencia({ novaTransferencia: novaTransacao })
        .then(() => {
            console.log('Transferência realizada com sucesso.');
            this.showToast('Sucesso', 'Registro salvo com sucesso!', 'success');
            this.getTransacoesPorUsuarioEData();
            this.handleFecharModal();
        })
        .catch(error => {
            if (error instanceof AuraHandledException) {
                console.error('Erro do cliente: ', error.message);
                this.showToast('Erro', error.message, 'error');
            } else {
                console.error('Erro inesperado: ', error);
                this.showToast('Erro', 'Ocorreu um erro inesperado. Tente novamente.', 'error');
            }
            console.error('Erro ao realizar transferência: ', error);
        });
    }

  
    getTransacoesPorUsuarioEData() {
        if (!this.mesReferencia) {
            console.error('Mês de referência não selecionado.');
            this.showToast('Erro', 'Selecione um mês de referência.', 'error');
            return;
        }

        getTransacoesPorUsuarioEData({ data: this.mesReferencia })
            .then(transacoes => {
                console.log('Transações recuperadas: ', transacoes);
                this.listaTransacoes = transacoes;
                this.listaEntradas = transacoes.filter(t => t.Tipo__c === 'Entrada');
                this.listaSaidas = transacoes.filter(t => t.Tipo__c === 'Saída');

                this.desenharGraficos();
            }
            )
            .catch(error => {
                console.error('Erro ao recuperar transações: ', error);
                this.showToast('Erro', 'Ocorreu um erro ao recuperar as transações. Tente novamente.', 'error');
            });
    }

   formatarValor(valor) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor);
    }

    agruparPorCategoria(lista) {
    const mapa = {};

    lista.forEach(item => {
        const cat = item.Categoria__c || 'Outros';
        mapa[cat] = (mapa[cat] || 0) + item.Valor__c;
    });

    return mapa;
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

    desenharGraficos() {
        if (!window.Chart) return;

        this.graficoEntradasSaidas();
        this.graficoEntradasCategoria();
        this.graficoSaidasCategoria();
    }


    chart1;
    chart2;
    chart3;

    graficoEntradasSaidas() {
        const ctx = this.template.querySelector('.grafico1');

        if (this.chart1) this.chart1.destroy();

        this.chart1 = new window.Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Entradas', 'Saídas'],
                datasets: [{
                    data: [this.valorTotalEntradas, this.valorTotalSaidas],
                    backgroundColor: ['#1f77b4', '#ff6384']
                }]
            },
            options: {
            responsive: true,
            cutout: '65%',
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {

                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const valor = context.raw;
                            const porcentagem = ((valor / total) * 100).toFixed(1);

                            return `${context.label}: ${porcentagem}%`;
                        }
                    }
                }
            }
        }
        });
    }

    graficoEntradasCategoria() {
        const ctx = this.template.querySelector('.grafico2');
        const dados = this.agruparPorCategoria(this.listaEntradas);

        if (this.chart2) this.chart2.destroy();

        this.chart2 = new window.Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(dados),
                datasets: [{
                    data: Object.values(dados),
                    backgroundColor: [
                        '#36a2eb',
                        '#4bc0c0',
                        '#9966ff',
                        '#ffcd56',
                        '#ff9f40',
                        '#8bc34a'
                    ]
                }]
            },
            options: {
            responsive: true,
            cutout: '65%',
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {

                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const valor = context.raw;
                            const porcentagem = ((valor / total) * 100).toFixed(1);

                            return `${context.label}: ${porcentagem}%`;
                        }
                    }
                }
            }
        }
        });
    }

    graficoSaidasCategoria() {
        const ctx = this.template.querySelector('.grafico3');
        const dados = this.agruparPorCategoria(this.listaSaidas);

        if (this.chart3) this.chart3.destroy();

        this.chart3 = new window.Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(dados),
                datasets: [{
                    data: Object.values(dados),
                    backgroundColor: [
                        '#ff6384',
                        '#ff9f40',
                        '#ffcd56',
                        '#c45850',
                        '#e91e63',
                        '#f44336'
                    ]
                }]
            },
            options: {
            responsive: true,
            cutout: '65%',
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {

                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const valor = context.raw;
                            const porcentagem = ((valor / total) * 100).toFixed(1);

                            return `${context.label}: ${porcentagem}%`;
                        }
                    }
                }
            }
        }
        });
    }
    handleToggle(event) {

        const tipo = event.target.dataset.tipo;
        const checked = event.target.checked;

        if (tipo === 'entrada') {
            this.entradaCad = {
                ...this.entradaCad,
                recorrente: checked
            };
        } else {
            this.saidaCad = {
                ...this.saidaCad,
                recorrente: checked
            };
        }
    }
}

