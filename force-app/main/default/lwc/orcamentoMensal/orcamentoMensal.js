import { LightningElement } from 'lwc';
import realizarTransferencia from '@salesforce/apex/TransferenciaController.realizarTransferencia';
import getTransacoesPorUsuarioEData from '@salesforce/apex/TransferenciaController.getTransacoesPorUsuarioEData';
import buscarMetaAtiva from '@salesforce/apex/MetaController.buscarMetaAtiva';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import chartjs from '@salesforce/resourceUrl/chart';
import { loadScript } from 'lightning/platformResourceLoader';

const CATEGORIA_META_MAP = {
    'Fixa':                 'GastosFixos__c',
    'Aluguel':              'GastosFixos__c',
    'Cartão de credito':    'GastosFixos__c',
    'Mercado':              'GastosFixos__c',
    'Reserva de Emergencia':'ReservaEmergencia__c',
    'Economia':             'ReservaEmergencia__c',
    'Investimento':         'Investimentos__c',
    'Liberdade financeira': 'Investimentos__c',
    'Diario':               'QualidadeDeVida__c',
    'Conforto':             'QualidadeDeVida__c',
    'Prazeres':             'QualidadeDeVida__c',
    'Conhecimento':         'DesenvolvimentoPessoal__c',
    'Objetivos':            'Objetivos__c'
};

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
    metaAtiva = null;


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
        this.carregarMetaAtiva();
    }

    carregarMetaAtiva() {
        buscarMetaAtiva()
            .then(meta => { this.metaAtiva = meta; })
            .catch(error => { console.error('Erro ao buscar meta ativa:', error); });
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
            diaEntrada: '1',
            recorrente: false,
            frequencia: 'Mensal'
        };

        this.saidaCad = {
            nomeSaida: '',
            tipoSaida: '',
            valorSaida: 0,
            valorFormatado: 'R$ 0,00',
            diaSaida: '1',
            recorrente: false,
            frequencia: 'Mensal'
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

        const [anoE, mesE] = this.mesReferencia.split('-');
        const data = new Date(Number(anoE), Number(mesE) - 1, Number(this.entradaCad.diaEntrada));

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

        const [anoS, mesS] = this.mesReferencia.split('-');
        const data = new Date(Number(anoS), Number(mesS) - 1, Number(this.saidaCad.diaSaida));

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
            console.error('Erro ao realizar transferência: ', error);
            const msg = error?.body?.message || 'Ocorreu um erro inesperado. Tente novamente.';
            this.showToast('Erro', msg, 'error');
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

    get distribuicaoPorCategoria() {
        if (!this.metaAtiva) return [];

        const realPorCategoria = {
            GastosFixos__c: 0,
            ReservaEmergencia__c: 0,
            Investimentos__c: 0,
            QualidadeDeVida__c: 0,
            DesenvolvimentoPessoal__c: 0,
            Objetivos__c: 0
        };

        this.listaSaidas.forEach(saida => {
            const campo = CATEGORIA_META_MAP[saida.Categoria__c];
            if (campo) realPorCategoria[campo] += saida.Valor__c;
        });

        const totalEntradas = this.valorTotalEntradas;

        return [
            { key: 'gf',  campo: 'GastosFixos__c',           nome: 'Gastos Fixos' },
            { key: 're',  campo: 'ReservaEmergencia__c',      nome: 'Reserva de Emergência' },
            { key: 'inv', campo: 'Investimentos__c',          nome: 'Investimentos' },
            { key: 'qv',  campo: 'QualidadeDeVida__c',        nome: 'Qualidade de Vida' },
            { key: 'dp',  campo: 'DesenvolvimentoPessoal__c', nome: 'Desenvolvimento Pessoal' },
            { key: 'obj', campo: 'Objetivos__c',             nome: 'Objetivos' }
        ].map(cat => {
            const percentualMeta  = this.metaAtiva[cat.campo] || 0;
            const valorEsperado   = (percentualMeta / 100) * totalEntradas;
            const valorReal       = realPorCategoria[cat.campo];
            const excedeu         = valorEsperado > 0 && valorReal > valorEsperado;
            const progresso       = valorEsperado > 0
                ? Math.min((valorReal / valorEsperado) * 100, 100)
                : (valorReal > 0 ? 100 : 0);

            const alerta = progresso >= 80 && !excedeu;
            return {
                key:           cat.key,
                nome:          cat.nome,
                percentualMeta,
                valorEsperadoFormatado: this.formatarValor(valorEsperado),
                valorRealFormatado:     this.formatarValor(valorReal),
                excedeu,
                alerta,
                cssBarraStyle: 'width:' + progresso + '%',
                cssBarraFill:  excedeu ? 'dist-fill dist-fill-excedeu' : (alerta ? 'dist-fill dist-fill-alerta' : 'dist-fill')
            };
        });
    }

    get temMetaAtiva() {
        return this.metaAtiva != null;
    }


    handleExportarCSV() {
        const header = ['Data', 'Nome', 'Tipo', 'Categoria', 'Valor', 'Pago'];
        const linhas = this.listaTransacoes.map(t => {
            const data = t.Data__c ? new Date(t.Data__c).toLocaleDateString('pt-BR') : '';
            const valor = t.Valor__c != null ? t.Valor__c.toString().replace('.', ',') : '0';
            const pago = t.Pago__c ? 'Sim' : 'Não';
            return [data, t.Name || '', t.Tipo__c || '', t.Categoria__c || '', valor, pago]
                .map(v => `"${String(v).replace(/"/g, '""')}"`)
                .join(';');
        });
        const csv = [header.join(';'), ...linhas].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `transacoes_${this.mesReferencia}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
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

