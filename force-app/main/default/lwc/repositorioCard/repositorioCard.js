import { LightningElement, api } from 'lwc';
import { TIPO_CASO, TIPO_QUERY, TIPO_SCRIPT, TIPO_ERRO, TIPO_PROCEDIMENTO, getTipoConfig } from 'c/repositorioConfig';

export default class RepositorioCard extends LightningElement {
    @api record;
    @api readOnly = false;
    @api showContext = false;

    get iconName() {
        return getTipoConfig(this.record.Tipo__c).iconName;
    }

    get typeLabel() {
        return getTipoConfig(this.record.Tipo__c).formLabel;
    }

    get theme() {
        return getTipoConfig(this.record.Tipo__c).theme;
    }

    get iconTileClass() {
        return `icon-tile theme-${this.theme}`;
    }

    get showContextLabel() {
        return this.showContext && this.contextLabel;
    }

    get contextLabel() {
        const clienteName = this.record.Cliente__r ? this.record.Cliente__r.Name : '';
        const projetoName = this.record.Projeto__r ? this.record.Projeto__r.Name : '';
        return [clienteName, projetoName].filter(Boolean).join(' / ');
    }

    get isCaso() {
        return this.record.Tipo__c === TIPO_CASO;
    }

    get isQuery() {
        return this.record.Tipo__c === TIPO_QUERY;
    }

    get isScript() {
        return this.record.Tipo__c === TIPO_SCRIPT;
    }

    get isErro() {
        return this.record.Tipo__c === TIPO_ERRO;
    }

    get isProcedimento() {
        return this.record.Tipo__c === TIPO_PROCEDIMENTO;
    }

    get primaryDescription() {
        if (this.isCaso) {
            return this.record.Resumo__c || this.record.Sintoma__c || 'Sem resumo preenchido.';
        }
        if (this.isQuery) {
            return this.record.ObjetoSalesforce__c || this.record.QuandoUsar__c || 'Query SOQL documentada.';
        }
        if (this.isScript) {
            return this.record.Objetivo__c || 'Script Anonymous Apex documentado.';
        }
        if (this.isErro) {
            return this.record.MensagemErro__c || this.record.OndeAcontece__c || 'Erro conhecido documentado.';
        }
        if (this.isProcedimento) {
            return this.record.Objetivo__c || 'Procedimento documentado.';
        }
        return this.record.Resumo__c || '';
    }

    get cardClass() {
        return this.showRiskAlert ? `record-card theme-${this.theme} high-risk` : `record-card theme-${this.theme}`;
    }

    get showRiskAlert() {
        return this.isScript && this.record.Risco__c === 'Alto';
    }

    get showCriticidade() {
        return Boolean(this.record.Criticidade__c && (this.isCaso || this.isErro));
    }

    get showRisco() {
        return Boolean(this.record.Risco__c && this.isScript);
    }

    get showCopy() {
        return this.isQuery || this.isScript;
    }

    get copyLabel() {
        return this.isQuery ? 'Copiar SOQL' : 'Copiar Script';
    }

    get copyValue() {
        return this.isQuery ? this.record.QuerySOQL__c : this.record.ScriptApex__c;
    }

    get criticidadeClass() {
        return `badge ${this.badgeTone(this.record.Criticidade__c)}`;
    }

    get riscoClass() {
        return `badge ${this.riskTone(this.record.Risco__c)}`;
    }

    get statusClass() {
        return `badge ${this.statusTone(this.record.Status__c)}`;
    }

    get details() {
        if (this.isCaso) {
            return this.cleanDetails([
                { label: 'Sintoma', value: this.record.Sintoma__c },
                { label: 'Investigação', value: this.record.ComoInvestigar__c }
            ]);
        }
        if (this.isQuery) {
            return this.cleanDetails([
                { label: 'Objeto', value: this.record.ObjetoSalesforce__c },
                { label: 'Ambiente', value: this.record.Ambiente__c || 'Todos' }
            ]);
        }
        if (this.isScript) {
            return this.cleanDetails([
                { label: 'Risco', value: this.record.Risco__c },
                { label: 'Ambiente', value: this.record.Ambiente__c }
            ]);
        }
        if (this.isErro) {
            return this.cleanDetails([
                { label: 'Mensagem', value: this.record.MensagemErro__c },
                { label: 'Onde acontece', value: this.record.OndeAcontece__c }
            ]);
        }
        return this.cleanDetails([
            { label: 'Objetivo', value: this.record.Objetivo__c },
            { label: 'Resultado', value: this.record.ResultadoEsperado__c }
        ]);
    }

    cleanDetails(items) {
        return items
            .filter((item) => item.value)
            .map((item) => ({
                label: item.label,
                value: item.value.length > 90 ? `${item.value.slice(0, 87)}...` : item.value
            }));
    }

    badgeTone(value) {
        if (value === 'Crítica') {
            return 'badge-red';
        }
        if (value === 'Alta') {
            return 'badge-orange';
        }
        if (value === 'Média') {
            return 'badge-yellow';
        }
        return 'badge-neutral';
    }

    riskTone(value) {
        if (value === 'Alto') {
            return 'badge-red';
        }
        if (value === 'Médio') {
            return 'badge-yellow';
        }
        return 'badge-green';
    }

    statusTone(value) {
        if (value === 'Ativo') {
            return 'badge-green';
        }
        if (value === 'Em revisão') {
            return 'badge-blue';
        }
        if (value === 'Obsoleto') {
            return 'badge-neutral';
        }
        return 'badge-gray';
    }

    handleDetail() {
        this.dispatchRecordEvent('detail');
    }

    handleEdit() {
        if (this.readOnly) {
            return;
        }
        this.dispatchRecordEvent('edit');
    }

    handleArchive() {
        if (this.readOnly) {
            return;
        }
        this.dispatchRecordEvent('archive');
    }

    handleCopy() {
        this.dispatchEvent(
            new CustomEvent('copytext', {
                detail: { id: this.record.Id, text: this.copyValue, label: this.copyLabel },
                bubbles: true,
                composed: true
            })
        );
    }

    dispatchRecordEvent(name) {
        this.dispatchEvent(
            new CustomEvent(name, {
                detail: { id: this.record.Id },
                bubbles: true,
                composed: true
            })
        );
    }
}
