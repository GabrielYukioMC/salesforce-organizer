export function formatarDataHora(dateTime) {
    if (!dateTime) {
        return null;
    }

    const data = new Date(dateTime);

    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(data);
}


export function formatarData(date) {
    if (!date) {
        return null;
    }

    const data = new Date(date);

    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(data);
}

export function calcularDiferencaDias(dataFutura, dataAtual) {
    const umDia = 24 * 60 * 60 * 1000; 
    const diferencaTempo = dataFutura.getTime() - dataAtual.getTime();
    return Math.ceil(diferencaTempo / umDia);
}

export function formatarMoeda(valor) {
    if (typeof valor !== 'number') {
        return null;
    }

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

export function formatarMoedaLocal(valor, locale, currency) {
    if (typeof valor !== 'number') {
        return null;
    }

    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency
    }).format(valor);
}

export function formatarNumero(valor) {
    if (typeof valor !== 'number') {
        return null;
    }
    
    return new Intl.NumberFormat('pt-BR').format(valor);
}


export function formatarPercentual(valor) {
    if (typeof valor !== 'number') {
        return null;
    }

    return new Intl.NumberFormat('pt-BR', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(valor);
}


export function parseBoolean(valor) {
    if (typeof valor === 'boolean') {
        return valor;
    }
    if (typeof valor === 'string') {
        return valor.toLowerCase() === 'true';
    }
    return false;
}
 