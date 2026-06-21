public class MeetingTranscriptPayload {
    @InvocableVariable(label='Título da Reunião')
    public String meetingTitle;

    @InvocableVariable(label='Data da Reunião')
    public String meetingDate;

    @InvocableVariable(label='ID da Conta')
    public String accountId;

    @InvocableVariable(label='Texto da Transcrição')
    public String transcriptText;

    @InvocableVariable(label='URL do Tactiq')
    public String transcriptUrl;

    @InvocableVariable(label='Anotações')
    public String anotacoes;

    public List<String> participants;
}