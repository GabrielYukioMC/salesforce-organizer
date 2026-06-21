public with sharing class UserStoryParser {

    public class UserStoryData {
        public String title;
        public String perfil;
        public String funcionalidade;
        public String beneficio;
        public String criteriosGherkin;
        public String prioridade;
    }

    public static List<UserStoryData> parseFromMinutes(String content) {
        List<UserStoryData> stories = new List<UserStoryData>();
        if (String.isBlank(content)) return stories;

        Integer startIdx = -1;
        List<String> markers = new List<String>{
            'USER STORIES', 'USER STORY', 'HISTÓRIAS DE USUÁRIO',
            'HISTORIAS DE USUARIO', 'US-01', '**US-01'
        };
        for (String marker : markers) {
            Integer idx = content.toUpperCase().indexOf(marker.toUpperCase());
            if (idx > -1 && (startIdx == -1 || idx < startIdx)) {
                startIdx = idx;
            }
        }
        if (startIdx == -1) return stories;

        String usSection = content.substring(startIdx);
        String[] lines   = usSection.split('\n');

        UserStoryData current = null;
        String gherkin        = '';
        Boolean inGherkin     = false;

        for (String line : lines) {
            String clean = line.replaceAll('\\*\\*', '').replaceAll('\\*', '').trim();
            if (String.isBlank(clean)) continue;

            String upper = clean.toUpperCase();

            Boolean isUSLine = (upper.startsWith('US-') || upper.startsWith('US '))
                && (clean.contains('|') || clean.length() < 80);

            if (isUSLine) {
                if (current != null) {
                    current.criteriosGherkin = gherkin.trim();
                    stories.add(current);
                }
                current   = new UserStoryData();
                gherkin   = '';
                inGherkin = false;

                if (clean.contains('|')) {
                    String[] parts = clean.split('\\|');
                    current.title = parts.size() > 1 ? parts[1].trim() : clean;

                    // Extrai prioridade da linha US-01 | Titulo | Prioridade: Alta
                    if (parts.size() > 2) {
                        String prioPart = parts[2].trim().toUpperCase()
                            .replace('PRIORIDADE:', '').replace('PRIORITY:', '').trim();
                        if (prioPart.contains('ALTA') || prioPart.contains('HIGH')) {
                            current.prioridade = 'Alta';
                        } else if (prioPart.contains('MEDIA') || prioPart.contains('MÉDIA')
                            || prioPart.contains('MEDIUM')) {
                            current.prioridade = 'Média';
                        } else if (prioPart.contains('BAIXA') || prioPart.contains('LOW')) {
                            current.prioridade = 'Baixa';
                        }
                    }
                } else {
                    current.title = clean.replaceAll('(?i)US-\\d+', '').trim();
                }
                continue;
            }

            if (current == null) continue;

            // Detecta linha de prioridade separada: "Prioridade: Alta"
            if (upper.startsWith('PRIORIDADE:') || upper.startsWith('PRIORITY:')) {
                String prioPart = upper.replace('PRIORIDADE:', '').replace('PRIORITY:', '').trim();
                if (prioPart.contains('ALTA')) current.prioridade = 'Alta';
                else if (prioPart.contains('MEDIA') || prioPart.contains('MÉDIA')) current.prioridade = 'Média';
                else if (prioPart.contains('BAIXA')) current.prioridade = 'Baixa';
                continue;
            }

            // Linha EU, COMO ... QUERO ... PARA
            if (upper.startsWith('EU,') || upper.startsWith('EU ')) {
                Integer comoIdx  = upper.indexOf('COMO');
                Integer queroIdx = upper.indexOf('QUERO');
                Integer paraIdx  = upper.indexOf('PARA');

                if (comoIdx > -1 && queroIdx > comoIdx) {
                    current.perfil = clean.substring(comoIdx + 4, queroIdx)
                        .trim().replaceAll(',', '').trim();
                }
                if (queroIdx > -1) {
                    Integer endFuncIdx = paraIdx > queroIdx ? paraIdx : clean.length();
                    current.funcionalidade = clean.substring(queroIdx + 5, endFuncIdx).trim();
                }
                if (paraIdx > -1) {
                    current.beneficio = clean.substring(paraIdx + 4).trim();
                }
                continue;
            }

            // Critérios Gherkin
            if (upper.startsWith('CRIT') || upper.startsWith('CENARIO') ||
                upper.startsWith('CENÁRIO') || upper.startsWith('DADO') ||
                upper.startsWith('QUANDO') || upper.startsWith('ENTÃO') ||
                upper.startsWith('ENTAO') || upper.startsWith('GIVEN') ||
                upper.startsWith('WHEN') || upper.startsWith('THEN')) {
                inGherkin = true;
            }
            if (inGherkin) {
                gherkin += clean + '\n';
            }
        }

        if (current != null) {
            current.criteriosGherkin = gherkin.trim();
            stories.add(current);
        }

        return stories;
    }

    public static List<UserStory__c> createUserStories(
        List<UserStoryData> stories,
        String accountId,
        String meetingTitle,
        String meetingMinutesId
    ) {
        List<UserStory__c> records = new List<UserStory__c>();
        if (stories == null || stories.isEmpty()) return records;

        for (UserStoryData story : stories) {
            UserStory__c us         = new UserStory__c();
            us.Name                 = String.isNotBlank(story.title) ? story.title.left(80) : 'User Story';
            us.Perfil__c            = story.perfil != null ? story.perfil.left(255) : '';
            us.Funcionalidade__c    = story.funcionalidade;
            us.Beneficio__c         = story.beneficio != null ? story.beneficio.left(255) : '';
            us.Criterios_Gherkin__c = story.criteriosGherkin;
            us.Status__c            = 'Backlog';
            us.Prioridade__c        = String.isNotBlank(story.prioridade) ? story.prioridade : 'Média';
            us.Account__c           = accountId;
            us.Reuniao__c           = meetingTitle != null ? meetingTitle.left(255) : '';
            us.Ata_de_Reuniao__c    = meetingMinutesId;
            records.add(us);
        }

        if (!records.isEmpty()) insert records;
        return records;
    }
}