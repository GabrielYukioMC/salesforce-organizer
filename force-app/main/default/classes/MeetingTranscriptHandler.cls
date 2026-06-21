@RestResource(urlMapping='/meeting-transcript/*')
global with sharing class MeetingTranscriptHandler {

    global class ActionResult {
        @InvocableVariable(label='Conteúdo da Ata')
        public String minutesContent;

        @InvocableVariable(label='ID do Meeting Minutes')
        public String meetingMinutesId;

        @InvocableVariable(label='Número de Tasks Criadas')
        public Integer tasksCreated;

        @InvocableVariable(label='User Stories Criadas')
        public Integer userStoriesCreated;

        @InvocableVariable(label='Status')
        public String status;
    }

    @InvocableMethod(
        label='Gerar Ata de Reunião'
        description='Busca transcrição e gera ata via Gemini AI'
    )
    public static List<ActionResult> generateMeetingMinutes(
        List<MeetingTranscriptPayload> payloads
    ) {
        List<ActionResult> results = new List<ActionResult>();

        for (MeetingTranscriptPayload payload : payloads) {
            ActionResult result = new ActionResult();
            try {
                // 1. Gera o conteúdo da ata
                String content = MeetingMinutesService.generateMinutes(payload);
                result.minutesContent = content;

                // 2. Cria o MeetingMinutes__c
                String mmId = MeetingMinutesService.createMeetingMinutes(
                    payload.meetingTitle,
                    content,
                    payload.transcriptText,
                    payload.accountId,
                    payload.meetingDate
                );
                result.meetingMinutesId = mmId;

                // 3. Cria Tasks vinculadas ao MeetingMinutes__c
                List<Task> tasks = MeetingTaskService.createTasksFromMinutes(
                    content, payload.accountId, mmId
                );
                result.tasksCreated = tasks.size();

                // 4. Parseia e cria User Stories vinculadas ao MeetingMinutes__c
                List<UserStoryParser.UserStoryData> stories =
                    UserStoryParser.parseFromMinutes(content);
                List<UserStory__c> usRecords =
                    UserStoryParser.createUserStories(
                        stories, payload.accountId, payload.meetingTitle, mmId
                    );
                result.userStoriesCreated = usRecords.size();
                result.status = 'success';

            } catch (Exception e) {
                result.status             = 'error|' + e.getMessage();
                result.tasksCreated       = 0;
                result.userStoriesCreated = 0;
            }
            results.add(result);
        }
        return results;
    }

    @HttpPost
    global static String receiveTranscript() {
        RestRequest  req = RestContext.request;
        RestResponse res = RestContext.response;
        try {
            MeetingTranscriptPayload payload =
                (MeetingTranscriptPayload) JSON.deserialize(
                    req.requestBody.toString(), MeetingTranscriptPayload.class
                );
            String content = MeetingMinutesService.generateMinutes(payload);
            String mmId    = MeetingMinutesService.createMeetingMinutes(
                payload.meetingTitle, content, payload.transcriptText,
                payload.accountId, payload.meetingDate
            );
            List<Task> tasks = MeetingTaskService.createTasksFromMinutes(
                content, payload.accountId, mmId
            );
            List<UserStoryParser.UserStoryData> stories =
                UserStoryParser.parseFromMinutes(content);
            List<UserStory__c> usRecords =
                UserStoryParser.createUserStories(
                    stories, payload.accountId, payload.meetingTitle, mmId
                );
            res.statusCode = 200;
            return JSON.serialize(new Map<String, Object>{
                'status'             => 'success',
                'meetingMinutesId'   => mmId,
                'tasksCreated'       => tasks.size(),
                'userStoriesCreated' => usRecords.size()
            });
        } catch (Exception e) {
            res.statusCode = 500;
            return JSON.serialize(new Map<String, String>{
                'status'  => 'error',
                'message' => e.getMessage()
            });
        }
    }
}