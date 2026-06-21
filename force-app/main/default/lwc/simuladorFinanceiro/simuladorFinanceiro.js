import { LightningElement, track, wire } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import chartJs from '@salesforce/resourceUrl/chart';
import buscarMetaAtiva from '@salesforce/apex/MetaController.buscarMetaAtiva';
import getResumoMensal from '@salesforce/apex/TransferenciaController.getResumoMensal';
import getTotaisPatrimonioAtual from '@salesforce/apex/TransferenciaController.getTotaisPatrimonioAtual';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

const FORMATTER_MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const CATEGORIAS_META = [
    { chave: 'GastosFixos__c',           rotulo: 'Gastos Fixos',       cor: '#ef4444' },
    { chave: 'Investimentos__c',          rotulo: 'Investimentos',      cor: '#22c55e' },
    { chave: 'ReservaEmergencia__c',      rotulo: 'Reserva Emergência', cor: '#3b82f6' },
    { chave: 'QualidadeDeVida__c',        rotulo: 'Qualidade de Vida',  cor: '#f59e0b' },
    { chave: 'DesenvolvimentoPessoal__c', rotulo: 'Desenv. Pessoal',    cor: '#8b5cf6' },
    { chave: 'Objetivos__c',              rotulo: 'Objetivos',          cor: '#06b6d4' },
];

const MARCOS_CONFIGURACAO = [
    { rotulo: 'Reserva 3 meses',    condicao: (p, g) => p.reservaAcumulada >= g * 3 },
    { rotulo: 'Reserva 6 meses',    condicao: (p, g) => p.reservaAcumulada >= g * 6 },
    { rotulo: 'Investimento R$ 10k', condicao: p => p.saldoInvestimentos >= 10000 },
    { rotulo: 'Investimento R$ 50k', condicao: p => p.saldoInvestimentos >= 50000 },
];

const COMPRA_VAZIA = () => ({ descricao: '', valor: 0, mesInicio: 1, numeroParcelas: 1 });

export default class SimuladorFinanceiro extends LightningElement {
    @track rendaMensal = 7282;
    @track rendimentoMensalPercentual = 0.8;
    @track inflacaoMensalPercentual = 0.35;
    @track usarMediasHistoricas = false;
    @track usarSaldoReal = false;
    @track saldoRealReserva = 0;
    @track saldoRealInvestimentos = 0;
    @track distribuicaoCategoria = [];
    @track marcosFinanceiros = [];
    @track totais = {};
    @track simulacaoRealizada = false;
    @track comprasPlaneadas = [];
    @track mostrarFormCompra = false;
    @track novaCompra = COMPRA_VAZIA();

    _horizonteMeses = 12;
    _metaAtiva = null;
    _mediaEntradas = 0;
    _chartCarregado = false;
    _grafico = null;
    _projecao = [];

    @wire(buscarMetaAtiva)
    _handleMetaAtiva({ data }) {
        if (data) {
            this._metaAtiva = data;
            this._atualizarDistribuicao();
        }
    }

    @wire(getResumoMensal, { meses: 6 })
    _handleResumoMensal({ data }) {
        if (data && data.length > 0) {
            this._mediaEntradas = data.reduce((soma, item) => soma + item.totalEntradas, 0) / data.length;
        }
    }

    @wire(getTotaisPatrimonioAtual)
    _handleTotaisPatrimonio({ data }) {
        if (data) {
            this.saldoRealReserva       = data.totalReserva   || 0;
            this.saldoRealInvestimentos = data.totalInvestido || 0;
        }
    }

    connectedCallback() {
        loadScript(this, chartJs)
            .then(() => { this._chartCarregado = true; })
            .catch(() => this._mostrarErro('Erro ao carregar biblioteca de gráficos.'));
    }

    // ── Getters ──────────────────────────────────────────────────────────────

    get horizonteMesesString() { return String(this._horizonteMeses); }

    get opcoesHorizonte() {
        const mesesRestantesNoAno = 12 - new Date().getMonth();
        return [
            { label: `Até o final do ano (${mesesRestantesNoAno} meses)`, value: 'fim_ano' },
            { label: '3 meses',  value: '3'  },
            { label: '6 meses',  value: '6'  },
            { label: '12 meses', value: '12' },
            { label: '24 meses', value: '24' },
            { label: '36 meses', value: '36' },
        ];
    }

    get temDistribuicao()     { return this.distribuicaoCategoria.length > 0; }
    get temMarcos()           { return this.marcosFinanceiros.length > 0; }
    get temComprasPlaneadas() { return this.comprasPlaneadas.length > 0; }

    get totalInvestidoFormatado()    { return FORMATTER_MOEDA.format(this.totais.totalInvestido    || 0); }
    get totalReservaFormatado()      { return FORMATTER_MOEDA.format(this.totais.totalReserva      || 0); }
    get rendimentoAcumuladoFormatado(){ return FORMATTER_MOEDA.format(this.totais.rendimentoAcumulado || 0); }
    get economiaTotalFormatado()     { return FORMATTER_MOEDA.format(this.totais.economiaTotal     || 0); }
    get saldoRealReservaFormatado()  { return FORMATTER_MOEDA.format(this.saldoRealReserva); }
    get saldoRealInvestidoFormatado(){ return FORMATTER_MOEDA.format(this.saldoRealInvestimentos); }

    get temSaldoReal() {
        return this.saldoRealReserva > 0 || this.saldoRealInvestimentos > 0;
    }

    get comprasPlaneadasFormatadas() {
        return this.comprasPlaneadas.map(compra => {
            const parcelaMensal = compra.valor / compra.numeroParcelas;
            return {
                ...compra,
                valorFormatado: FORMATTER_MOEDA.format(compra.valor),
                rotuloParcelamento: compra.numeroParcelas === 1
                    ? 'À vista'
                    : `${compra.numeroParcelas}x ${FORMATTER_MOEDA.format(parcelaMensal)}`,
            };
        });
    }

    get labelMesInicioNovaCompra() {
        const mes = parseInt(this.novaCompra.mesInicio, 10);
        if (!mes || mes < 1) return '';
        const dataRef = new Date();
        dataRef.setMonth(dataRef.getMonth() + mes);
        return dataRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }

    get novaCompraForaDaHorizonte() {
        const mes = parseInt(this.novaCompra.mesInicio, 10);
        return mes > this._horizonteMeses;
    }

    get temDeficit() {
        return this._projecao.some(p => p.temDeficit);
    }

    get quantidadeMesesDeficit() {
        return this._projecao.filter(p => p.temDeficit).length;
    }

    get mensagemDeficit() {
        const qtd = this.quantidadeMesesDeficit;
        return `${qtd} ${qtd === 1 ? 'mês' : 'meses'} com renda insuficiente — as compras planejadas excedem o disponível e reduzirão sua reserva.`;
    }

    // ── Handlers ─────────────────────────────────────────────────────────────

    handleRendaChange(event) {
        this.rendaMensal = parseFloat(event.target.value) || 0;
        this._atualizarDistribuicao();
    }

    handleHorizonteChange(event) {
        const valor = event.target.value;
        this._horizonteMeses = valor === 'fim_ano'
            ? 12 - new Date().getMonth()
            : parseInt(valor, 10);
    }

    handleRendimentoChange(event) {
        this.rendimentoMensalPercentual = parseFloat(event.target.value) || 0;
    }

    handleInflacaoChange(event) {
        this.inflacaoMensalPercentual = parseFloat(event.target.value) || 0;
    }

    handleUsarMediasHistoricas(event) {
        this.usarMediasHistoricas = event.target.checked;
        if (this.usarMediasHistoricas && this._mediaEntradas > 0) {
            this.rendaMensal = parseFloat(this._mediaEntradas.toFixed(2));
            this._atualizarDistribuicao();
        }
    }

    handleUsarSaldoReal(event) {
        this.usarSaldoReal = event.target.checked;
    }

    handleSimular() {
        this._calcularProjecao();
        this._calcularMarcos();
        this._calcularTotais();
        this.simulacaoRealizada = true;
        setTimeout(() => this._renderizarGrafico(), 100);
    }

    handleToggleFormCompra() {
        this.mostrarFormCompra = !this.mostrarFormCompra;
    }

    handleNovaCompraChange(event) {
        const campo = event.target.dataset.campo;
        this.novaCompra = { ...this.novaCompra, [campo]: event.target.value };
    }

    handleAdicionarCompra() {
        const valor = parseFloat(this.novaCompra.valor) || 0;
        const descricao = String(this.novaCompra.descricao || '').trim();
        if (!descricao || valor <= 0) {
            this._mostrarErro('Informe descrição e valor para adicionar a compra.');
            return;
        }
        this.comprasPlaneadas = [
            ...this.comprasPlaneadas,
            {
                id:              Date.now(),
                descricao,
                valor,
                mesInicio:       parseInt(this.novaCompra.mesInicio,       10) || 1,
                numeroParcelas:  parseInt(this.novaCompra.numeroParcelas,  10) || 1,
            },
        ];
        this.novaCompra       = COMPRA_VAZIA();
        this.mostrarFormCompra = false;
    }

    handleRemoverCompra(event) {
        const idRemover = parseInt(event.currentTarget.dataset.id, 10);
        this.comprasPlaneadas = this.comprasPlaneadas.filter(c => c.id !== idRemover);
    }

    // ── Cálculos ─────────────────────────────────────────────────────────────

    _atualizarDistribuicao() {
        if (!this._metaAtiva) return;
        this.distribuicaoCategoria = CATEGORIAS_META.map(categoria => {
            const percentual = this._metaAtiva[categoria.chave] || 0;
            const valor = this.rendaMensal * percentual / 100;
            return {
                chave:               categoria.chave,
                rotulo:              categoria.rotulo,
                percentualFormatado: `${percentual}%`,
                valorFormatado:      FORMATTER_MOEDA.format(valor),
                estilosBarra:        `width: ${Math.min(percentual, 100)}%; background-color: ${categoria.cor};`,
            };
        });
    }

    _calcularTotalComprasMes(mes) {
        return this.comprasPlaneadas.reduce((total, compra) => {
            const mesFim = compra.mesInicio + compra.numeroParcelas - 1;
            return (mes >= compra.mesInicio && mes <= mesFim)
                ? total + compra.valor / compra.numeroParcelas
                : total;
        }, 0);
    }

    _calcularProjecao() {
        const taxaRendimento       = this.rendimentoMensalPercentual / 100;
        const taxaInflacao         = this.inflacaoMensalPercentual   / 100;
        const percentualInvest     = (this._metaAtiva ? this._metaAtiva.Investimentos__c     : 20) / 100;
        const percentualReserva    = (this._metaAtiva ? this._metaAtiva.ReservaEmergencia__c : 10) / 100;
        const percentualSalvavel   = percentualInvest + percentualReserva;
        const percentualGastos     = 1 - percentualSalvavel;

        let saldoInvestimentos  = this.usarSaldoReal ? this.saldoRealInvestimentos : 0;
        let reservaAcumulada    = this.usarSaldoReal ? this.saldoRealReserva       : 0;
        let rendimentoAcumulado = 0;
        this._projecao = [];

        for (let mes = 1; mes <= this._horizonteMeses; mes++) {
            const comprasMes     = this._calcularTotalComprasMes(mes);
            const gastosMensais  = this.rendaMensal * percentualGastos * Math.pow(1 + taxaInflacao, mes);
            const saldoParaSalvar = this.rendaMensal - gastosMensais - comprasMes;

            let aporteInvest, aporteReserva;
            const temDeficit = saldoParaSalvar < 0;

            if (saldoParaSalvar >= this.rendaMensal * percentualSalvavel) {
                aporteInvest  = this.rendaMensal * percentualInvest;
                aporteReserva = this.rendaMensal * percentualReserva;
            } else if (saldoParaSalvar > 0 && percentualSalvavel > 0) {
                aporteInvest  = saldoParaSalvar * (percentualInvest   / percentualSalvavel);
                aporteReserva = saldoParaSalvar * (percentualReserva  / percentualSalvavel);
            } else {
                aporteInvest  = 0;
                aporteReserva = saldoParaSalvar; // negativo → reduz reserva
            }

            const rendimentoMes  = saldoInvestimentos * taxaRendimento;
            rendimentoAcumulado += rendimentoMes;
            saldoInvestimentos   = saldoInvestimentos * (1 + taxaRendimento) + aporteInvest;
            reservaAcumulada    += aporteReserva;

            const dataReferencia = new Date();
            dataReferencia.setMonth(dataReferencia.getMonth() + mes);
            const rotulomes = dataReferencia
                .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
                .replace('.', '');

            this._projecao.push({
                mes,
                label: rotulomes,
                saldoInvestimentos,
                reservaAcumulada,
                patrimonio: saldoInvestimentos + reservaAcumulada,
                gastosMensais,
                comprasMes,
                rendimentoAcumulado,
                temDeficit,
            });
        }
    }

    _calcularMarcos() {
        const percentualInvest  = (this._metaAtiva ? this._metaAtiva.Investimentos__c     : 20) / 100;
        const percentualReserva = (this._metaAtiva ? this._metaAtiva.ReservaEmergencia__c : 10) / 100;
        const gastosBase = this.rendaMensal * (1 - percentualInvest - percentualReserva);

        this.marcosFinanceiros = MARCOS_CONFIGURACAO.reduce((lista, cfg) => {
            const ponto = this._projecao.find(p => cfg.condicao(p, gastosBase));
            if (ponto) {
                lista.push({
                    rotulo:         cfg.rotulo,
                    mensagemMeses:  `em ${ponto.label} (${ponto.mes} ${ponto.mes === 1 ? 'mês' : 'meses'})`,
                });
            }
            return lista;
        }, []);
    }

    _calcularTotais() {
        if (!this._projecao.length) return;
        const ultimo = this._projecao[this._projecao.length - 1];
        this.totais = {
            totalInvestido:      ultimo.saldoInvestimentos,
            totalReserva:        ultimo.reservaAcumulada,
            rendimentoAcumulado: ultimo.rendimentoAcumulado,
            economiaTotal:       ultimo.patrimonio,
        };
    }

    _renderizarGrafico() {
        if (!this._chartCarregado || !this._projecao.length) return;
        const canvas = this.template.querySelector('.grafico-evolucao');
        if (!canvas) return;

        if (this._grafico) this._grafico.destroy();

        const datasetsCompras = this.comprasPlaneadas.length > 0 ? [{
            type:            'bar',
            label:           'Compras planejadas',
            data:            this._projecao.map(p => parseFloat(p.comprasMes.toFixed(2))),
            backgroundColor: 'rgba(239,68,68,0.35)',
            borderColor:     '#ef4444',
            borderWidth:     1,
        }] : [];

        this._grafico = new window.Chart(canvas, {
            type: 'line',
            data: {
                labels: this._projecao.map(p => p.label),
                datasets: [
                    {
                        label:           'Patrimônio Acumulado',
                        data:            this._projecao.map(p => parseFloat(p.patrimonio.toFixed(2))),
                        borderColor:     '#6366f1',
                        backgroundColor: 'rgba(99,102,241,0.1)',
                        fill:            true,
                        tension:         0.4,
                        borderWidth:     2,
                    },
                    {
                        label:           'Investimentos',
                        data:            this._projecao.map(p => parseFloat(p.saldoInvestimentos.toFixed(2))),
                        borderColor:     '#22c55e',
                        backgroundColor: 'transparent',
                        tension:         0.4,
                        borderWidth:     2,
                        borderDash:      [5, 5],
                    },
                    {
                        label:           'Reserva',
                        data:            this._projecao.map(p => parseFloat(p.reservaAcumulada.toFixed(2))),
                        borderColor:     '#3b82f6',
                        backgroundColor: 'transparent',
                        tension:         0.4,
                        borderWidth:     2,
                        borderDash:      [3, 3],
                    },
                    ...datasetsCompras,
                ],
            },
            options: {
                responsive:          true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
                    tooltip: {
                        callbacks: { label: ctx => ` ${FORMATTER_MOEDA.format(ctx.parsed.y)}` },
                    },
                },
                scales: {
                    y: {
                        ticks: { callback: v => FORMATTER_MOEDA.format(v), font: { size: 10 }, maxRotation: 0 },
                        grid:  { color: 'rgba(0,0,0,0.05)' },
                    },
                    x: { ticks: { font: { size: 10 } } },
                },
            },
        });
    }

    _mostrarErro(mensagem) {
        this.dispatchEvent(new ShowToastEvent({ title: 'Erro', message: mensagem, variant: 'error' }));
    }
}