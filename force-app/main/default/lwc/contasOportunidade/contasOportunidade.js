import { LightningElement, api, wire, track } from 'lwc';
import getAccounts from '@salesforce/apex/CompradorController.getAccounts';

import NOME_F from '@salesforce/schema/Account.Name';
import RENDA_MENSAL_F from '@salesforce/schema/Account.Renda_Mensal__c';
import TELEFONE_F from '@salesforce/schema/Account.Phone';

import { getRecord, getFieldValue } from 'lightning/uiRecordApi';

import Opportunity from '@salesforce/schema/Opportunity'

const COLS = [
    { label: 'Nome', fieldName: NOME_F.fieldApiName, type: 'text' },
    { label: 'Renda Mensal', fieldName: RENDA_MENSAL_F.fieldApiName, type: 'text' },
    { label: 'Telefone', fieldName: TELEFONE_F.fieldApiName, type: 'text' },    
];

export default class TabelaEx extends LightningElement {
    @api recordId;
    @wire(getAccounts, {}) contas;
    cols = COLS;

    renderedCallback() {
        console.log('recordId:', this.recordId);
    }
}