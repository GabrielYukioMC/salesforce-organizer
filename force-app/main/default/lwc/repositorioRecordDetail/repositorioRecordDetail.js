import { LightningElement, api } from 'lwc';
import { TIPO_CASO, TIPO_ERRO, TIPO_PROCEDIMENTO, TIPO_QUERY, TIPO_SCRIPT, getTipoConfig } from 'c/repositorioConfig';

export default class RepositorioRecordDetail extends LightningElement {
    @api record;
    @api readOnly = false;

    get iconName() {
        return getTipoConfig(this.record.Tipo__c).iconName;
    }

    get clienteName() {
        return this.record.Cliente__r ? this.record.Cliente__r.Name : '';
    }

    get projetoName() {
        return this.record.Projeto__r ? this.record.Projeto__r.Name : '';
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

    get showRiskAlert() {
        return this.isScript && this.record.Risco__c === 'Alto';
    }

    get backupLabel() {
        return this.record.ExigeBackup__c ? 'Exige backup' : 'Backup não marcado';
    }

    get aprovacaoLabel() {
        return this.record.ExigeAprovacao__c ? 'Exige aprovação' : 'Aprovação não marcada';
    }

    handleClose() {
        this.dispatchEvent(new CustomEvent('close'));
    }

    handleEdit() {
        if (this.readOnly) {
            return;
        }
        this.dispatchEvent(
            new CustomEvent('edit', {
                detail: { id: this.record.Id },
                bubbles: true,
                composed: true
            })
        );
    }

    forwardCopy(event) {
        this.dispatchEvent(
            new CustomEvent('copytext', {
                detail: event.detail,
                bubbles: true,
                composed: true
            })
        );
    }
}
