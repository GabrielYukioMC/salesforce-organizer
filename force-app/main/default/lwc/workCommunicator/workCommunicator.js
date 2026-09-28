import { LightningElement, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getContext from '@salesforce/apex/WorkCommunicationController.getContext';
import getMessages from '@salesforce/apex/WorkCommunicationController.getMessages';
import publish from '@salesforce/apex/WorkCommunicationController.publish';
import getComments from '@salesforce/apex/WorkCommunicationController.getComments';
import comment from '@salesforce/apex/WorkCommunicationController.comment';
import getSlaStatus from '@salesforce/apex/CaseSLAStatusController.getStatus';

export default class WorkCommunicator extends LightningElement {
    _recordId;
    _connected = false;
    _version = 0;
    _feedVersion = 0;
    context;
    posts = [];
    targetId;
    filterId = '';
    kind = 'Atualização';
    body = '';
    selectedWorkId;
    busy = false;
    sending = false;
    hasMore = false;
    error;
    replyText = '';
    activePost;
    refreshedAt;
    uploadedFiles = [];
    replyFiles = [];
    slaData;
    slaError;
    kinds = ['Atualização', 'Dúvida', 'Impedimento', 'Decisão'].map(value => ({ label: value, value }));

    @api get recordId() { return this._recordId; }
    set recordId(value) {
        if (value === this._recordId) return;
        this._version++;
        this._feedVersion++;
        this._recordId = value;
        this.context = undefined;
        this.posts = [];
        this.targetId = undefined;
        this.selectedWorkId = undefined;
        this.filterId = '';
        this.body = '';
        this.activePost = undefined;
        this.replyText = '';
        this.uploadedFiles = [];
        this.replyFiles = [];
        this.slaData = undefined;
        this.slaError = undefined;
        if (this._connected && value) this.refresh();
    }
    connectedCallback() { this._connected = true; if (this.recordId) this.refresh(); }
    disconnectedCallback() { this._connected = false; this._version++; this._feedVersion++; }
    get caseId() { return this.context?.caseId || undefined; }
    @wire(getSlaStatus, { recordId: '$caseId' })
    wiredSla(result) {
        const { data, error } = result;
        if (data) {
            this.slaData = data;
            this.slaError = undefined;
        } else if (error) {
            this.slaData = undefined;
            this.slaError = error;
        }
    }
    get slaStatus() { return this.slaData?.slaStatus || 'Não disponível'; }
    get slaPhase() { return this.slaData?.phase || '—'; }
    get slaBalance() {
        if (!this.slaData) return this.slaError ? 'Não disponível' : 'Calculando';
        if (this.slaData.firstResponseAt ? this.slaData.workViolated : this.slaData.attendanceViolated) {
            return `${this.formatHours(this.slaData.activeOverdueHours)} vencido`;
        }
        return `${this.formatHours(this.slaData.activeRemainingHours)} restantes`;
    }
    get attendanceDeadline() { return this.slaData?.attendanceDeadline; }
    get workDeadline() { return this.slaData?.workDeadline; }
    get targetOptions() { return this.context?.targets || []; }
    get filterOptions() { return [{ label: 'Toda a demanda', value: '' }, ...this.targetOptions]; }
    get destinationId() { return this.targetOptions.find(item => item.value === this.targetId)?.destination; }
    get taskSelected() { return this.targetId && this.destinationId !== this.targetId; }
    get workOptions() {
        return (this.context?.works || []).map(work => ({ label: `${work.Name} · ${work.Titulo__c}`, value: work.Id }));
    }
    get hasWorks() { return this.workOptions.length > 0; }
    get currentStage() { return this.context?.works?.find(work => work.Id === this.selectedWorkId)?.Etapa__c || 'Aguardando desenvolvimento'; }
    get empty() { return !this.busy && !this.posts.length; }
    get structuredEmpty() { return !this.busy && !this.structuredPosts.length; }
    get sendDisabled() { return this.sending || this.busy || !this.targetId || !this.body.trim(); }
    get nativeUrl() { return this.destinationId ? `/${this.destinationId}` : undefined; }
    get uploadLabel() { return this.uploadedFiles.length ? 'Adicionar mais arquivos' : 'Anexar arquivos'; }
    get hasUploadedFiles() { return this.uploadedFiles.length > 0; }
    get replyUploadLabel() { return this.replyFiles.length ? 'Adicionar mais arquivos' : 'Anexar arquivos'; }
    get hasReplyFiles() { return this.replyFiles.length > 0; }
    get activePostParentId() { return this.posts.find(post => post.id === this.activePost)?.parentId; }
    get metrics() {
        const c = this.context || {};
        return [{ label: 'Subworks', value: c.subworks || 0 }, { label: 'Tarefas', value: c.tasks || 0 },
            { label: 'Critérios de aceite', value: c.criteria || 0 }, { label: 'Cenários de teste', value: c.scenarios || 0 }];
    }
    get structuredPosts() {
        return this.posts.map(post => ({ ...post, ...this.originStyle(post.parentId, post.origin) }));
    }
    originStyle(parentId, label) {
        const work = this.context?.works?.find(item => item.Id === parentId);
        if (parentId === this.context?.caseId) return { originType: 'Case', originIcon: 'standard:case', structureClass: 'structured-card origin-case' };
        if (work && parentId === this.context?.rootId) return { originType: 'Work principal', originIcon: 'standard:work_order', structureClass: 'structured-card origin-work' };
        if (work) return { originType: 'Subwork', originIcon: 'standard:work_order_item', structureClass: 'structured-card origin-subwork' };
        if (label?.startsWith('Critério')) return { originType: 'Critério', originIcon: 'utility:success', structureClass: 'structured-card origin-criterion' };
        if (label?.startsWith('Cenário')) return { originType: 'Cenário', originIcon: 'utility:record', structureClass: 'structured-card origin-scenario' };
        if (label?.startsWith('Tarefa')) return { originType: 'Tarefa', originIcon: 'standard:task', structureClass: 'structured-card origin-task' };
        if (label?.startsWith('Projeto')) return { originType: 'Projeto', originIcon: 'standard:account', structureClass: 'structured-card origin-project' };
        return { originType: 'Outro', originIcon: 'standard:feed', structureClass: 'structured-card origin-other' };
    }
    message(error) { return error?.body?.message || error?.message || 'Não foi possível concluir. Confira seu acesso e tente novamente.'; }
    toast(title, message, variant = 'success') { this.dispatchEvent(new ShowToastEvent({ title, message, variant })); }
    async refresh() {
        const version = ++this._version;
        this.busy = true;
        this.error = undefined;
        try {
            const data = await getContext({ recordId: this.recordId });
            if (version !== this._version) return;
            this.context = data;
            if (!data.targets.some(item => item.value === this.targetId)) this.targetId = data.targets.find(item => item.value === this.recordId)?.value || data.targets[0]?.value;
            if (!data.works.some(work => work.Id === this.selectedWorkId)) this.selectedWorkId = data.works.find(work => work.Id === this.recordId)?.Id || data.rootId;
            if (this.filterId && !data.targets.some(item => item.value === this.filterId)) this.filterId = '';
            await this.loadMessages(false);
            this.refreshedAt = new Date().toLocaleTimeString('pt-BR');
        } catch (error) { if (version === this._version) this.error = this.message(error); }
        finally { if (version === this._version) this.busy = false; }
    }
    async loadMessages(append = false) {
        const version = ++this._feedVersion;
        const last = append ? this.posts[this.posts.length - 1] : undefined;
        const data = await getMessages({ recordId: this.recordId, targetId: this.filterId || null,
            beforeDate: last?.createdAt || null, beforeId: last?.id || null });
        if (version !== this._feedVersion) return;
        const items = data.items.map(item => {
            const kind = item.body?.match(/^\[([^\]]+)\]/)?.[1] || 'Chatter';
            const displayBody = item.body?.replace(/^\[[^\]]+\]\s*/, '') || 'Publicação com arquivo ou conteúdo. Abra no Chatter para visualizar.';
            return { ...item, url: `/${item.id}`, originUrl: `/${item.parentId}`,
                kind, commentLabel: `Comentários (${item.comments || 0})`, displayBody,
                hasAttachments: item.attachments?.length > 0,
                attachmentCount: item.attachments?.length || 0,
                attachments: this.decorateAttachments(item.attachments || []) };
        });
        this.posts = append ? [...this.posts, ...items] : items;
        this.hasMore = data.hasMore;
        this.activePost = undefined;
        this.replyText = '';
    }
    decorateAttachments(files) {
        return files.map(file => {
            const title = file.title || 'Arquivo';
            const extension = (file.extension || file.fileType || '').toLowerCase();
            return {
                ...file,
                title,
                extension,
                iconName: this.iconFor(file.fileType || extension),
                openUrl: `/lightning/r/ContentDocument/${file.documentId}/view`,
                downloadUrl: `/sfc/servlet.shepherd/document/download/${file.documentId}`,
                thumbnailUrl: file.isImage && file.versionId
                    ? `/sfc/servlet.shepherd/version/renditionDownload?rendition=THUMB720BY480&versionId=${file.versionId}`
                    : undefined,
                sizeLabel: this.formatSize(file.size)
            };
        });
    }
    iconFor(type) {
        const value = (type || '').toLowerCase();
        if (['pdf'].includes(value)) return 'doctype:pdf';
        if (['xls', 'xlsx', 'excel', 'csv'].includes(value)) return 'doctype:excel';
        if (['doc', 'docx', 'word'].includes(value)) return 'doctype:word';
        if (['ppt', 'pptx', 'powerpoint'].includes(value)) return 'doctype:ppt';
        if (['zip', 'rar', '7z'].includes(value)) return 'doctype:zip';
        if (['txt', 'text'].includes(value)) return 'doctype:txt';
        if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'tif', 'tiff'].includes(value)) return 'doctype:image';
        return 'doctype:attachment';
    }
    formatSize(size) {
        const value = Number(size || 0);
        if (!value) return '';
        if (value < 1024) return `${value} B`;
        if (value < 1048576) return `${(value / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB`;
        return `${(value / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
    }
    formatHours(value) {
        if (value === null || value === undefined) return '--';
        const numericValue = Number(value);
        if (numericValue <= 0) return '0h';
        const hours = Math.floor(numericValue);
        const minutes = Math.round((numericValue - hours) * 60);
        if (hours === 0) return `${minutes}min`;
        if (minutes === 0) return `${hours}h`;
        return `${hours}h ${minutes}min`;
    }
    async filterChanged(event) {
        this.filterId = event.detail.value;
        this.busy = true;
        this.posts = [];
        try { await this.loadMessages(); } catch (error) { this.error = this.message(error); }
        finally { this.busy = false; }
    }
    async more() {
        this.busy = true;
        try { await this.loadMessages(true); } catch (error) { this.error = this.message(error); }
        finally { this.busy = false; }
    }
    targetChanged(event) { this.targetId = event.detail.value; }
    kindChanged(event) { this.kind = event.detail.value; }
    bodyChanged(event) { this.body = event.target.value; }
    workChanged(event) { this.selectedWorkId = event.detail.value; }
    replyChanged(event) { this.replyText = event.target.value; }
    stageSaved() { this.toast('Etapa atualizada', 'A etapa da Work foi salva.'); this.refresh(); }
    stageError(event) { this.toast('Não foi possível salvar', event.detail.message, 'error'); }
    async send() {
        this.sending = true;
        try {
            await publish({ recordId: this.recordId, targetId: this.targetId, kind: this.kind, body: this.body, documentIds: this.uploadedFiles.map(file => file.documentId) });
            this.body = '';
            this.uploadedFiles = [];
            this.toast('Mensagem publicada', 'A publicação está no Chatter do registro escolhido.');
            await this.loadMessages();
        } catch (error) { this.toast('Não foi possível publicar', this.message(error), 'error'); }
        finally { this.sending = false; }
    }
    filesUploaded(event) {
        const current = new Map(this.uploadedFiles.map(file => [file.documentId, file]));
        event.detail.files.forEach(file => current.set(file.documentId, {
            documentId: file.documentId,
            title: file.name,
            iconName: this.iconFor(file.name?.split('.').pop()),
            openUrl: `/lightning/r/ContentDocument/${file.documentId}/view`
        }));
        this.uploadedFiles = [...current.values()];
        this.toast('Arquivos anexados', 'Eles aparecerão junto da publicação depois de enviar a mensagem.');
    }
    removeUploadedFile(event) {
        const id = event.currentTarget.dataset.id;
        this.uploadedFiles = this.uploadedFiles.filter(file => file.documentId !== id);
    }
    async openComments(event) {
        const id = event.currentTarget.dataset.id;
        await this.loadComments(id, true);
    }
    async loadComments(id, resetDraft = false) {
        this.sending = true;
        try {
            const comments = await getComments({ recordId: this.recordId, postId: id });
            this.activePost = id;
            if (resetDraft) {
                this.replyText = '';
                this.replyFiles = [];
            }
            const replies = comments.map(reply => ({
                ...reply,
                hasAttachments: reply.attachments?.length > 0,
                attachments: this.decorateAttachments(reply.attachments || [])
            }));
            this.posts = this.posts.map(post => ({ ...post, expanded: post.id === id,
                replies: post.id === id ? replies : [] }));
        } catch (error) { this.toast('Comentários indisponíveis', this.message(error), 'error'); }
        finally { this.sending = false; }
    }
    replyFilesUploaded(event) {
        const current = new Map(this.replyFiles.map(file => [file.documentId, file]));
        event.detail.files.forEach(file => current.set(file.documentId, {
            documentId: file.documentId,
            title: file.name,
            iconName: this.iconFor(file.name?.split('.').pop()),
            openUrl: `/lightning/r/ContentDocument/${file.documentId}/view`
        }));
        this.replyFiles = [...current.values()];
        this.toast('Arquivos anexados', 'Eles serão enviados junto da resposta.');
    }
    removeReplyFile(event) {
        const id = event.currentTarget.dataset.id;
        this.replyFiles = this.replyFiles.filter(file => file.documentId !== id);
    }
    async sendReply() {
        this.sending = true;
        try {
            const postId = this.activePost;
            await comment({ recordId: this.recordId, postId: this.activePost, body: this.replyText, documentIds: this.replyFiles.map(file => file.documentId) });
            this.toast('Comentário publicado', 'Sua resposta foi adicionada à publicação original.');
            this.replyText = '';
            this.replyFiles = [];
            await this.loadMessages();
            await this.loadComments(postId);
        } catch (error) { this.toast('Não foi possível comentar', this.message(error), 'error'); }
        finally { this.sending = false; }
    }
}
