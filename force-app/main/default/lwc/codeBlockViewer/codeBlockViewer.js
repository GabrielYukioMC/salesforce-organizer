import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CodeBlockViewer extends LightningElement {
    @api label = 'Código';
    @api value = '';
    @api copyLabel = 'Copiar';

    async handleCopy() {
        if (!this.value) {
            this.toast('Nada para copiar', 'Este bloco está vazio.', 'warning');
            return;
        }

        try {
            await navigator.clipboard.writeText(this.value);
            this.toast('Copiado', `${this.copyLabel} copiado para a área de transferência.`, 'success');
        } catch (error) {
            this.dispatchEvent(
                new CustomEvent('copytext', {
                    detail: { text: this.value, label: this.copyLabel },
                    bubbles: true,
                    composed: true
                })
            );
        }
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
