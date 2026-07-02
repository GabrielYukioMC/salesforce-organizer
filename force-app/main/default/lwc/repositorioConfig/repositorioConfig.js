export const TIPO_CASO = 'Caso recorrente';
export const TIPO_QUERY = 'Query SOQL';
export const TIPO_SCRIPT = 'Script Anonymous Apex';
export const TIPO_ERRO = 'Erro conhecido';
export const TIPO_PROCEDIMENTO = 'Procedimento';

export const TABS = [
    {
        label: 'Casos recorrentes',
        value: TIPO_CASO,
        iconName: 'utility:case',
        newLabel: 'Novo Caso Recorrente',
        formLabel: 'Caso Recorrente',
        theme: 'case'
    },
    {
        label: 'Queries SOQL',
        value: TIPO_QUERY,
        iconName: 'utility:search',
        newLabel: 'Nova Query SOQL',
        formLabel: 'Query SOQL',
        theme: 'query'
    },
    {
        label: 'Scripts Apex',
        value: TIPO_SCRIPT,
        iconName: 'utility:code_playground',
        newLabel: 'Novo Script Apex',
        formLabel: 'Script Apex',
        theme: 'script'
    },
    {
        label: 'Erros conhecidos',
        value: TIPO_ERRO,
        iconName: 'utility:error',
        newLabel: 'Novo Erro Conhecido',
        formLabel: 'Erro Conhecido',
        theme: 'error'
    },
    {
        label: 'Procedimentos',
        value: TIPO_PROCEDIMENTO,
        iconName: 'utility:steps',
        newLabel: 'Novo Procedimento',
        formLabel: 'Procedimento',
        theme: 'procedure'
    }
];

export const STATUS_OPTIONS = [
    { label: 'Ativo', value: 'Ativo' },
    { label: 'Em revisão', value: 'Em revisão' },
    { label: 'Obsoleto', value: 'Obsoleto' },
    { label: 'Arquivado', value: 'Arquivado' }
];

export const CRITICIDADE_OPTIONS = [
    { label: 'Baixa', value: 'Baixa' },
    { label: 'Média', value: 'Média' },
    { label: 'Alta', value: 'Alta' },
    { label: 'Crítica', value: 'Crítica' }
];

export const RISCO_OPTIONS = [
    { label: 'Baixo', value: 'Baixo' },
    { label: 'Médio', value: 'Médio' },
    { label: 'Alto', value: 'Alto' }
];

export const AMBIENTE_OPTIONS = [
    { label: 'DEV', value: 'DEV' },
    { label: 'HM', value: 'HM' },
    { label: 'PROD', value: 'PROD' },
    { label: 'Todos', value: 'Todos' },
    { label: 'HM/PROD', value: 'HM/PROD' },
    { label: 'DEV/HM', value: 'DEV/HM' }
];

export const REQUIRED_BY_TYPE = {
    [TIPO_CASO]: ['Name', 'Cliente__c', 'Projeto__c', 'Tipo__c', 'Status__c', 'Sintoma__c', 'ComoInvestigar__c', 'ComoResolver__c'],
    [TIPO_QUERY]: ['Name', 'Cliente__c', 'Projeto__c', 'Tipo__c', 'Status__c', 'QuandoUsar__c', 'QuerySOQL__c'],
    [TIPO_SCRIPT]: ['Name', 'Cliente__c', 'Projeto__c', 'Tipo__c', 'Status__c', 'Objetivo__c', 'ScriptApex__c', 'Risco__c', 'Ambiente__c'],
    [TIPO_ERRO]: ['Name', 'Cliente__c', 'Projeto__c', 'Tipo__c', 'Status__c', 'MensagemErro__c', 'SolucaoConhecida__c'],
    [TIPO_PROCEDIMENTO]: ['Name', 'Cliente__c', 'Projeto__c', 'Tipo__c', 'Status__c', 'Objetivo__c', 'Passos__c']
};

export function getTipoConfig(tipo) {
    return TABS.find((tab) => tab.value === tipo) || TABS[0];
}

export function normalizeRecord(record) {
    return JSON.parse(JSON.stringify(record || {}));
}
