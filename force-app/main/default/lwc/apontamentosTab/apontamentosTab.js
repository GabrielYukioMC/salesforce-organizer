import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import buscarPorSemana          from '@salesforce/apex/ApontamentoController.buscarPorSemana';
import gerarApontamentosSemana  from '@salesforce/apex/ApontamentoFixoController.gerarApontamentosSemana';
import enviarSemana             from '@salesforce/apex/EnvioApontamentoController.enviarSemana';

const PX_POR_HORA = 80;
const HORA_INICIO  = 9;
const HORA_FIM     = 18;
const DIAS_NOMES   = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ── Paleta "Ocean & Forest" ──────────────────────────────────
// Degradê de verdes e azuis, sem vermelhos nem roxos.
const COR_PADRAO   = '#3b82f6';  // azul moderno (padrão desativado)
const COR_ESPECIAL = '#3b82f6';  // âmbar — COE, Almoço, COE Gestão
const NOMES_CINZA  = new Set(['COE', 'Almoço', 'COE Gestão']);
const CORES_DESTAQUE = [
    '#166534', // verde floresta
    '#15803d', // verde médio
    '#16a34a', // verde vibrante
    '#22c55e', // verde claro vivo — ainda legível em fundo escuro
    '#0f766e', // teal escuro
    '#0d9488', // teal médio
    '#0891b2', // ciano profundo
    '#0284c7', // azul céu
    '#0369a1', // azul médio
    '#1d4ed8', // azul royal
    '#1e40af', // azul escuro
    '#155e75', // azul petróleo
    '#164e63', // azul petróleo escuro
    '#065f46', // esmeralda escuro
    '#064e3b', // verde profundo
];

export default class ApontamentosTab extends LightningElement {

    @track carregando     = false;
    @track gerandoSemana  = false;
    @track mostrarRotinas = false;
    @track destacar       = false;
    @track enviando       = false;
    @track apontamentos   = [];
    semanaInicio; // Date (segunda-feira da semana atual)

    connectedCallback() {
        this.semanaInicio = this._getDomingo(new Date());
        this._carregar();
    }

    // ── Navegação ────────────────────────────────────────────────

    semanaAnterior() {
        const d = new Date(this.semanaInicio);
        d.setDate(d.getDate() - 7);
        this.semanaInicio = d;
        this._carregar();
    }

    proximaSemana() {
        const d = new Date(this.semanaInicio);
        d.setDate(d.getDate() + 7);
        this.semanaInicio = d;
        this._carregar();
    }

    irParaHoje() {
        this.semanaInicio = this._getDomingo(new Date());
        this._carregar();
    }

    gerarSemana() {
        this.gerandoSemana = true;
        gerarApontamentosSemana({ semanaInicioISO: this._toDateStr(this.semanaInicio) })
            .then(() => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Sucesso',
                    message: 'Apontamentos gerados com sucesso.',
                    variant: 'success'
                }));
                this._carregar();
            })
            .catch(err => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Erro',
                    message: err.body?.message || 'Não foi possível gerar os apontamentos.',
                    variant: 'error'
                }));
            })
            .finally(() => { this.gerandoSemana = false; });
    }

    toggleRotinas() {
        this.mostrarRotinas = !this.mostrarRotinas;
    }

    enviarParaElera() {
        this.enviando = true;
        enviarSemana({ semanaInicioISO: this._toDateStr(this.semanaInicio) })
            .then(res => {
                const msg = res.erros > 0
                    ? `${res.enviados} enviados, ${res.erros} com erro.`
                    : ` apontamentos enviados com sucesso.`;
                this.dispatchEvent(new ShowToastEvent({
                    title: res.erros > 0 ? 'Envio parcial' : 'Sucesso',
                    message: msg,
                    variant: res.erros > 0 ? 'warning' : 'success'
                }));
            })
            .catch(err => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Erro ao enviar',
                    message: err.body?.message || 'Não foi possível enviar os apontamentos.',
                    variant: 'error'
                }));
            })
            .finally(() => { this.enviando = false; });
    }

    toggleDestacar() {
        this.destacar = !this.destacar;
    }

    get labelDestacar() {
        return this.destacar ? 'Destacar: ON' : 'Destacar';
    }

    get variantDestacar() {
        return this.destacar ? 'brand' : 'neutral';
    }

    // ── Getters de apresentação ──────────────────────────────────

    get labelSemana() {
        const fim = new Date(this.semanaInicio);
        fim.setDate(fim.getDate() + 6);
        return `${this._dataFormatada(this.semanaInicio)} – ${this._dataFormatada(fim)}`;
    }

    // Total de horas: soma apenas apontamentos que COMEÇAM na semana (evita dupla contagem)
    get totalHorasSemana() {
        const semFim = new Date(this.semanaInicio);
        semFim.setDate(semFim.getDate() + 7);
        const total = this.apontamentos
            .filter(a => {
                const ini = new Date(a.Inicio__c);
                return ini >= this.semanaInicio && ini < semFim;
            })
            .reduce((s, a) => s + (a.DuracaoHoras__c || 0), 0);
        return Math.round(total * 10) / 10;
    }

    // Eixo Y: labels de horas (09:00 … 18:00)
    get horasEixo() {
        const slots = [];
        for (let h = HORA_INICIO; h <= HORA_FIM; h++) {
            const top = (h - HORA_INICIO) * PX_POR_HORA;
            slots.push({
                key: h,
                label: `${String(h).padStart(2, '0')}:00`,
                lineStyle: `top: ${top}px;`
            });
        }
        return slots;
    }

    get diasDaSemana() {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        return DIAS_NOMES.map((nome, i) => {
            const d = new Date(this.semanaInicio);
            d.setDate(d.getDate() + i);
            d.setHours(0, 0, 0, 0);
            const chave    = this._toDateStr(d);
            const ehHoje   = d.getTime() === hoje.getTime();

            // Limites do dia (meia-noite até meia-noite)
            const diaInicio = new Date(d);
            const diaFim    = new Date(d);
            diaFim.setHours(23, 59, 59, 999);

            // Filtra apontamentos que SOBREPÕEM este dia
            const aps = this.apontamentos
                .filter(a => {
                    const apIni = new Date(a.Inicio__c);
                    const apFim = a.Fim__c ? new Date(a.Fim__c) : new Date(apIni.getTime() + 3600000);
                    return apIni <= diaFim && apFim > diaInicio;
                })
                .map(a => this._mapApontamentoPorDia(a, d, chave))
                .filter(ap => ap !== null);

            // Total de horas: conta apenas apontamentos que COMEÇAM neste dia
            const totalHoras = this.apontamentos
                .filter(a => this._toDateStr(new Date(a.Inicio__c)) === chave)
                .reduce((s, a) => s + (a.DuracaoHoras__c || 0), 0);

            return {
                key: chave,
                diaNome: nome,
                dataFormatada: `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`,
                colClass: `dia-col${ehHoje ? ' dia-hoje' : ''}`,
                apontamentos: aps,
                temApontamentos: aps.length > 0,
                totalHoras: totalHoras > 0 ? Math.round(totalHoras * 10) / 10 : null
            };
        });
    }

    // ── Carga de dados ───────────────────────────────────────────

    _carregar() {
        this.carregando = true;
        buscarPorSemana({ semanaInicioISO: this._toDateStr(this.semanaInicio) })
            .then(data => { this.apontamentos = data; })
            .catch(() => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Erro',
                    message: 'Não foi possível carregar os apontamentos.',
                    variant: 'error'
                }));
            })
            .finally(() => { this.carregando = false; });
    }

    // ── Utilitários ──────────────────────────────────────────────

    /**
     * Calcula o segmento visível de um apontamento em um dia específico.
     * Apontamentos multi-dia aparecem em cada coluna com a fatia de horário correta.
     *   - Dia de início   → mostra a partir da hora real de início
     *   - Dias do meio    → bloco do topo (HORA_INICIO) até o fim (HORA_FIM)
     *   - Dia de fim      → mostra até a hora real de fim
     */
    _mapApontamentoPorDia(a, dia, chave) {
        const apInicio = new Date(a.Inicio__c);
        const apFim    = a.Fim__c ? new Date(a.Fim__c) : new Date(apInicio.getTime() + 3600000);

        // Janela visível do dia (horas de trabalho)
        const janelaIni = new Date(dia);
        janelaIni.setHours(HORA_INICIO, 0, 0, 0);
        const janelaFim = new Date(dia);
        janelaFim.setHours(HORA_FIM, 0, 0, 0);

        // Segmento visível = interseção entre o apontamento e a janela do dia
        let segIni = new Date(Math.max(+apInicio, +janelaIni));
let segFim = new Date(Math.min(+apFim, +janelaFim));

// 🔥 se não sobrou nada dentro do horário de trabalho, não renderiza
if (segFim <= segIni) {
    return null;
}
const horaDecIni = Math.max(HORA_INICIO, segIni.getHours() + segIni.getMinutes() / 60);
const horaDecFim = Math.min(HORA_FIM, segFim.getHours() + segFim.getMinutes() / 60);
        const top    = Math.max(0, (horaDecIni - HORA_INICIO)) * PX_POR_HORA;
        const height = Math.max(20, (horaDecFim - horaDecIni) * PX_POR_HORA);

        const isInicioNesteDia = this._toDateStr(apInicio) === chave;
        const isFimNesteDia    = this._toDateStr(apFim)    === chave;

        // Rótulos: hora real no dia de início/fim; seta indicando continuidade nos demais
        const labelIni = isInicioNesteDia ? this._formatarHora(apInicio) : '↑';
        const labelFim = isFimNesteDia    ? this._formatarHora(apFim)    : '↓';

        const bgColor = this._corApontamento(a.Name);

        return {
            ...a,
            segKey:     `${a.Id}_${chave}`,   // chave única por segmento de dia
            horaInicio: labelIni,
            horaFim:    labelFim,
            style:      `top: ${top}px; height: ${height}px; background: ${bgColor};`,
            isMultiDia: !isInicioNesteDia || !isFimNesteDia
        };
    }

    _corApontamento(nome) {
        if (!this.destacar) return COR_PADRAO;
        if (NOMES_CINZA.has(nome)) return COR_ESPECIAL;
        return CORES_DESTAQUE[this._hashNome(nome)];
    }

    _hashNome(nome) {
        let hash = 0;
        for (let i = 0; i < nome.length; i++) {
            hash = (hash * 31 + nome.codePointAt(i)) & 0x7fffffff;
        }
        return hash % CORES_DESTAQUE.length;
    }

    _getDomingo(d) {
        const dom = new Date(d);
        dom.setDate(d.getDate() - d.getDay()); // getDay() 0=Dom … 6=Sáb
        dom.setHours(0, 0, 0, 0);
        return dom;
    }

    _toDateStr(d) {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    _formatarHora(d) {
        return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }

    _dataFormatada(d) {
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    }
}
