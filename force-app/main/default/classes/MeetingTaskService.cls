public with sharing class MeetingTaskService {

    public static List<Task> createTasksFromMinutes(
        String minutesContent,
        String accountId,
        String meetingMinutesId
    ) {
        List<Task> tasks = new List<Task>();

        String section = extractSection(minutesContent, 'PROXIMOS PASSOS');
        if (String.isBlank(section)) {
            section = extractSection(minutesContent, 'PRÓXIMOS PASSOS');
        }
        if (String.isBlank(section)) return tasks;

        for (String line : section.split('\n')) {
            String clean = line.replaceAll('\\*\\*', '').replaceAll('\\*', '').trim();
            if (String.isBlank(clean)) continue;
            if (!clean.contains('|')) continue;

            if (clean.startsWith('|')) clean = clean.substring(1).trim();
            if (clean.endsWith('|')) clean = clean.substring(0, clean.length() - 1).trim();

            String sepCheck = clean.replaceAll('-', '').replaceAll('\\|', '')
                .replaceAll(':', '').replaceAll(' ', '').trim();
            if (sepCheck == '') continue;

            String[] parts = clean.split('\\|');
            if (parts.size() < 1) continue;

            String subject  = parts[0].trim();
            String owner    = parts.size() > 1 ? parts[1].trim() : '';
            String deadline = parts.size() > 2 ? parts[2].trim() : '';

            if (subject.equalsIgnoreCase('Ação') || subject.equalsIgnoreCase('Acao')
                || subject.equalsIgnoreCase('Action') || subject.equalsIgnoreCase('Atividade')) continue;
            if (String.isBlank(subject)) continue;

            Task t = new Task();
            t.Subject                = subject.length() > 255 ? subject.substring(0, 255) : subject;
            t.Description            = 'Responsável: ' + owner + '\nPrazo: ' + deadline
                + '\nGerado automaticamente via Ata de Reunião';
            t.Status                 = 'Not Started';
            t.Priority               = 'Normal';
            t.ActivityDate           = Date.today().addDays(7);
            t.WhatId                 = accountId;
            tasks.add(t);
        }

        if (!tasks.isEmpty()) insert tasks;
        return tasks;
    }

    public static String extractSection(String content, String sectionName) {
        if (String.isBlank(content)) return '';

        String searchTerm = sectionName.toUpperCase()
            .replace('Ó','O').replace('Ô','O').replace('Á','A').replace('Â','A')
            .replace('É','E').replace('Ê','E').replace('Í','I').replace('Ú','U')
            .replace('Ã','A').replace('Õ','O').replace('Ç','C');

        String contentNorm = content.toUpperCase()
            .replaceAll('\\*\\*','').replaceAll('\\*','')
            .replace('Ó','O').replace('Ô','O').replace('Á','A').replace('Â','A')
            .replace('É','E').replace('Ê','E').replace('Í','I').replace('Ú','U')
            .replace('Ã','A').replace('Õ','O').replace('Ç','C');

        Integer startIdx = contentNorm.indexOf(searchTerm);
        if (startIdx == -1) return '';

        Integer lineEnd = content.indexOf('\n', startIdx);
        if (lineEnd == -1) return '';

        String remaining = content.substring(lineEnd + 1);
        String remainingNorm = remaining.toUpperCase()
            .replaceAll('\\*\\*','').replaceAll('\\*','')
            .replace('Ó','O').replace('Á','A').replace('É','E')
            .replace('Í','I').replace('Ú','U').replace('Ã','A')
            .replace('Õ','O').replace('Ç','C');

        Integer nextSection = -1;
        List<String> sections = new List<String>{
            'PARTICIPANTES', 'ASSUNTOS DISCUTIDOS', 'PONTOS PRINCIPAIS',
            'GAPS IDENTIFICADOS', 'RESUMO FINAL', 'USER STORIES', 'US-01',
            '6. RESUMO', '7. USER', '\n6.', '\n7.', '\n8.'
        };

        for (String s : sections) {
            String sNorm = s.replace('Ó','O').replace('Á','A').replace('É','E')
                .replace('Ã','A').replace('Ç','C');
            Integer idx = remainingNorm.indexOf(sNorm);
            if (idx > 0 && (nextSection == -1 || idx < nextSection)) {
                nextSection = idx;
            }
        }

        return nextSection > 0
            ? remaining.substring(0, nextSection).trim()
            : remaining.trim();
    }
}