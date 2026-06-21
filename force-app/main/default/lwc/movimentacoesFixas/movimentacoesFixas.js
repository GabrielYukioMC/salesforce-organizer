import { LightningElement } from 'lwc';

export default class MovimentacoesFixas extends LightningElement {

    descricao = '';
    valor;
    tipo = 'SAIDA';
    recorrencia = 'TODOS';
    mesInicio;

    tipoOptions = [
        { label: 'Entrada', value: 'ENTRADA' },
        { label: 'Saída', value: 'SAIDA' }
    ];

    recorrenciaOptions = [
        { label: 'Todos os meses', value: 'TODOS' },
        { label: 'A partir de um mês', value: 'A_PARTIR' }
    ];

    get mostrarMesInicio() {
        return this.recorrencia === 'A_PARTIR';
    }

    handleDescricao(e) { this.descricao = e.target.value; }
    handleValor(e) { this.valor = Number(e.target.value); }
    handleTipo(e) { this.tipo = e.target.value; }
    handleRecorrencia(e) { this.recorrencia = e.target.value; }
    handleMesInicio(e) { this.mesInicio = e.target.value; }

    salvarFixo() {
        const fixo = {
            id: crypto.randomUUID(),
            descricao: this.descricao,
            valor: this.valor,
            tipo: this.tipo,
            recorrencia: this.recorrencia,
            mesInicio: this.mesInicio
        };

        this.dispatchEvent(new CustomEvent('salvarfixo', {
            detail: fixo
        }));

        this.reset();
    }

    reset() {
        this.descricao = '';
        this.valor = null;
        this.tipo = 'SAIDA';
        this.recorrencia = 'TODOS';
        this.mesInicio = null;
    }
}