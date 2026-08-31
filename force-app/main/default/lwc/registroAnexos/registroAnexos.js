import { LightningElement, api, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getAnexos from '@salesforce/apex/RegistroAnexoController.getAnexos';
import uploadAnexo from '@salesforce/apex/RegistroAnexoController.uploadAnexo';
import excluirAnexo from '@salesforce/apex/RegistroAnexoController.excluirAnexo';

const MAX_ANEXOS = 3;
const MAX_TAMANHO_BYTES = 2 * 1024 * 1024;
const EXTENSOES_BLOQUEADAS = new Set(['exe', 'bat', 'cmd', 'sh', 'msi', 'dll', 'com', 'scr', 'jar', 'ps1', 'vbs', 'app']);
const ICONS_POR_EXTENSAO = {
    pdf: 'doctype:pdf',
    doc: 'doctype:word',
    docx: 'doctype:word',
    xls: 'doctype:excel',
    xlsx: 'doctype:excel',
    csv: 'doctype:csv',
    ppt: 'doctype:ppt',
    pptx: 'doctype:ppt',
    png: 'doctype:image',
    jpg: 'doctype:image',
    jpeg: 'doctype:image',
    gif: 'doctype:image',
    zip: 'doctype:zip',
    txt: 'doctype:txt'
};

export default class RegistroAnexos extends NavigationMixin(LightningElement) {
    @api recordId;
    @api readOnly = false;

    @track anexos = [];

    loading = false;
    uploading = false;

    connectedCallback() {
        this.loadAnexos();
    }

    async loadAnexos() {
        this.loading = true;
        try {
            const resultado = await getAnexos({ registroId: this.recordId });
            this.anexos = resultado.map((anexo) => this.mapAnexo(anexo));
        } catch (error) {
            this.handleError(error);
        } finally {
            this.loading = false;
        }
    }

    mapAnexo(anexo) {
        return {
            ...anexo,
            displayName: anexo.fileExtension ? `${anexo.title}.${anexo.fileExtension.toLowerCase()}` : anexo.title,
            iconName: this.iconForExtension(anexo.fileExtension),
            sizeLabel: this.formatSize(anexo.contentSize)
        };
    }

    get contadorLabel() {
        return `${this.anexos.length}/${MAX_ANEXOS} anexos`;
    }

    get semAnexos() {
        return !this.loading && this.anexos.length === 0;
    }

    get podeAnexar() {
        return !this.readOnly && this.anexos.length < MAX_ANEXOS && !this.uploading;
    }

    get limiteAtingido() {
        return !this.readOnly && this.anexos.length >= MAX_ANEXOS;
    }

    async handleFileChange(event) {
        const file = event.target.files && event.target.files[0];
        event.target.value = '';
        if (!file) {
            return;
        }

        const extensao = this.extensionOf(file.name);
        if (EXTENSOES_BLOQUEADAS.has(extensao)) {
            this.showToast('Arquivo não permitido', `Tipo de arquivo .${extensao} não é permitido.`, 'error');
            return;
        }
        if (file.size > MAX_TAMANHO_BYTES) {
            this.showToast('Arquivo muito grande', 'O arquivo excede o tamanho máximo permitido de 2MB.', 'error');
            return;
        }

        this.uploading = true;
        try {
            const base64Data = await this.readFileAsBase64(file);
            const anexo = await uploadAnexo({
                registroId: this.recordId,
                fileName: file.name,
                base64Data
            });
            this.anexos = [this.mapAnexo(anexo), ...this.anexos];
            this.showToast('Arquivo anexado', `"${file.name}" foi anexado com sucesso.`, 'success');
        } catch (error) {
            this.handleError(error);
        } finally {
            this.uploading = false;
        }
    }

    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    handlePreview(event) {
        const contentDocumentId = event.currentTarget.dataset.id;
        this[NavigationMixin.Navigate]({
            type: 'standard__namedPage',
            attributes: { pageName: 'filePreview' },
            state: { selectedRecordId: contentDocumentId }
        });
    }

    async handleRemove(event) {
        if (this.readOnly) {
            return;
        }
        const contentDocumentId = event.currentTarget.dataset.id;
        const anexo = this.anexos.find((item) => item.contentDocumentId === contentDocumentId);
        if (!anexo || !window.confirm(`Remover o anexo "${anexo.displayName}"?`)) {
            return;
        }

        try {
            await excluirAnexo({ registroId: this.recordId, contentDocumentId });
            this.anexos = this.anexos.filter((item) => item.contentDocumentId !== contentDocumentId);
            this.showToast('Anexo removido', `"${anexo.displayName}" foi removido.`, 'success');
        } catch (error) {
            this.handleError(error);
        }
    }

    extensionOf(fileName) {
        const lastDot = fileName.lastIndexOf('.');
        return lastDot >= 0 ? fileName.substring(lastDot + 1).toLowerCase() : '';
    }

    iconForExtension(extension) {
        return ICONS_POR_EXTENSAO[(extension || '').toLowerCase()] || 'doctype:unknown';
    }

    formatSize(bytes) {
        if (!bytes) {
            return '0 KB';
        }
        if (bytes < 1024 * 1024) {
            return `${Math.max(1, Math.round(bytes / 1024))} KB`;
        }
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    handleError(error) {
        const message = error && error.body && error.body.message ? error.body.message : 'Não foi possível concluir a operação. Verifique os dados e tente novamente.';
        this.showToast('Erro', message, 'error');
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
