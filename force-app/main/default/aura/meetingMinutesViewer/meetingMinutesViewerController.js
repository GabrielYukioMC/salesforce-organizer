({
    onRecordLoaded: function(component, event, helper) {
        var record = component.get('v.record');
        if (!record) return;
        component.set('v.meetingTitle', record.Name || 'Ata de Reunião');
        component.set('v.meetingDate', record.Data_Reuniao__c || '');
        var conteudo = record.Conteudo_Ata__c || '';
        component.set('v.conteudo', conteudo);
        component.set('v.temas', helper.parseConteudo(conteudo));
    },

 downloadTXT: function(component, event, helper) {
    var conteudo = component.get('v.conteudo');
    var title = component.get('v.meetingTitle');
    
    // Codifica o conteúdo em base64 para evitar bloqueio do Aura
    var encoded = 'data:text/plain;charset=utf-8,' + encodeURIComponent(conteudo);
    
    var a = document.createElement('a');
    a.setAttribute('href', encoded);
    a.setAttribute('download', title + '.txt');
    a.setAttribute('target', '_blank');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
})