import { LightningElement, track } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import chartJs from '@salesforce/resourceUrl/chart';
import getResumoMensal from '@salesforce/apex/TransferenciaController.getResumoMensal';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = v => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v) + '%';

export default class ResumoMensal extends LightningElement {
    @track dados = [];
    @track carregando = true;
    _chartCarregado = false;
    _grafico1; _grafico2;

    connectedCallback() {
        loadScript(this, chartJs)
            .then(() => {
                this._chartCarregado = true;
                this._carregarDados();
            })
            .catch(err => {
                this.dispatchEvent(new ShowToastEvent({ title: 'Erro', message: 'Erro ao carregar Chart.js', variant: 'error' }));
                console.error(err);
            });
    }

    _carregarDados() {
        getResumoMensal({ meses: 6 })
            .then(data => {
                this.dados = data.map(d => ({
                    ...d,
                    totalEntradasFmt: fmt.format(d.totalEntradas),
                    totalSaidasFmt: fmt.format(d.totalSaidas),
                    saldoFmt: fmt.format(d.saldo),
                    taxaPoupancaFmt: pct(d.taxaPoupanca)
                }));
                this.carregando = false;
                this._renderizarGraficos();
            })
            .catch(err => {
                this.carregando = false;
                this.dispatchEvent(new ShowToastEvent({ title: 'Erro', message: err?.body?.message || 'Erro ao carregar resumo.', variant: 'error' }));
            });
    }

    _renderizarGraficos() {
        if (!this._chartCarregado || !this.dados.length) return;
        const labels = this.dados.map(d => d.mesLabel);

        const g1 = this.template.querySelector('.grafico-barras');
        const g2 = this.template.querySelector('.grafico-saldo');
        if (!g1 || !g2) return;

        if (this._grafico1) this._grafico1.destroy();
        if (this._grafico2) this._grafico2.destroy();

        // eslint-disable-next-line no-undef
        this._grafico1 = new Chart(g1, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Entradas', data: this.dados.map(d => d.totalEntradas), backgroundColor: '#27ae60' },
                    { label: 'Saídas', data: this.dados.map(d => d.totalSaidas), backgroundColor: '#e74c3c' }
                ]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });

        // eslint-disable-next-line no-undef
        this._grafico2 = new Chart(g2, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Saldo',
                    data: this.dados.map(d => d.saldo),
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52,152,219,0.15)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }

    get mediaEntradas() { return fmt.format(this._media('totalEntradas')); }
    get mediaSaidas() { return fmt.format(this._media('totalSaidas')); }
    get mediaTaxaPoupanca() { return pct(this._media('taxaPoupanca')); }
    get saldoAcumulado() { return fmt.format(this.dados.reduce((s, d) => s + d.saldo, 0)); }
    get projecaoSaldo() {
        const ultimos = this.dados.slice(-3);
        if (!ultimos.length) return fmt.format(0);
        return fmt.format(ultimos.reduce((s, d) => s + d.saldo, 0) / ultimos.length);
    }

    _media(campo) {
        if (!this.dados.length) return 0;
        return this.dados.reduce((s, d) => s + d[campo], 0) / this.dados.length;
    }
}
