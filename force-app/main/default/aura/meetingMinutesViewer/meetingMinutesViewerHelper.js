({
    parseConteudo: function(conteudo) {
        if (!conteudo) return [];
        var lines = conteudo.split('\n');
        var temas = [];
        var currentTema = null;
        var currentSection = null;
        var buffer = [];

        var self = this;

        var saveSection = function() {
            if (!currentTema || !currentSection) return;
            var text = buffer.join('\n').trim();
            if (!text) return;

            if (currentSection === 'CONTEXTO') {
                currentTema.contexto = text;
            } else if (currentSection === 'GAPS') {
                currentTema.gaps = text.split('\n')
                    .map(function(l) { return l.replace(/^[-*•]\s*/, '').replace(/\*\*/g, '').trim(); })
                    .filter(function(l) { return l.length > 0; });
            } else if (currentSection === 'PASSOS') {
                currentTema.proximosPassos = self.parseTable(text);
            } else if (currentSection === 'US') {
                currentTema.userStories = self.parseUserStories(text);
            }
            buffer = [];
        };

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var clean = line.replace(/\*\*/g, '').trim();
            var upper = clean.toUpperCase();

            if (upper.indexOf('## TEMA:') !== -1) {
                saveSection();
                if (currentTema) temas.push(currentTema);
                currentTema = {
                    nome: clean.replace(/##\s*TEMA:/i, '').trim().toUpperCase(),
                    contexto: null,
                    gaps: [],
                    proximosPassos: [],
                    userStories: []
                };
                currentSection = null;
                buffer = [];
                continue;
            }

            if (!currentTema) continue;

            if (upper.indexOf('### CONTEXTO') !== -1 || upper.indexOf('ENRIQUECIMENTO') !== -1) {
                saveSection(); currentSection = 'CONTEXTO'; continue;
            }
            if (upper.indexOf('GAPS IDENTIFICADOS') !== -1 || upper.indexOf('GAPS ADICIONAIS') !== -1) {
                saveSection(); currentSection = 'GAPS'; continue;
            }
            if (upper.indexOf('PROXIMOS PASSOS') !== -1 || upper.indexOf('PRÓXIMOS PASSOS') !== -1) {
                saveSection(); currentSection = 'PASSOS'; continue;
            }
            if (upper.indexOf('USER STORIES') !== -1) {
                saveSection(); currentSection = 'US'; continue;
            }

            buffer.push(line);
        }

        saveSection();
        if (currentTema) temas.push(currentTema);
        return temas;
    },

    parseTable: function(text) {
        var rows = [];
        var lines = text.split('\n').filter(function(l) { return l.indexOf('|') !== -1; });
        for (var i = 0; i < lines.length; i++) {
            var cols = lines[i].split('|').map(function(c) { return c.trim(); }).filter(function(c) { return c; });
            if (cols.length < 2) continue;
            if (cols[0].replace(/-/g, '').trim() === '') continue;
            var first = cols[0].toLowerCase();
            if (first === 'acao' || first === 'ação' || first === 'action') continue;
            rows.push({ acao: cols[0] || '', responsavel: cols[1] || '', prazo: cols[2] || '' });
        }
        return rows;
    },

    parseUserStories: function(text) {
        var stories = [];
        var lines = text.split('\n');
        var current = null;
        var gherkinLines = [];
        var inGherkin = false;

        for (var i = 0; i < lines.length; i++) {
            var clean = lines[i].replace(/\*\*/g, '').trim();
            var upper = clean.toUpperCase();

            if ((upper.indexOf('US-') === 0 || upper.indexOf('US ') === 0) && clean.indexOf('|') !== -1) {
                if (current) {
                    current.gherkin = gherkinLines.join('\n').trim();
                    stories.push(current);
                }
                var parts = clean.split('|').map(function(p) { return p.trim(); });
                var prioRaw = (parts[2] || '').replace(/prioridade:/i, '').trim();
                var prioClass = 'prio-media';
                if (prioRaw.toUpperCase().indexOf('ALTA') !== -1) prioClass = 'prio-alta';
                else if (prioRaw.toUpperCase().indexOf('BAIXA') !== -1) prioClass = 'prio-baixa';

                current = {
                    id: parts[0] || '',
                    titulo: parts[1] || '',
                    prioridade: prioRaw || 'Média',
                    prioridadeClass: prioClass,
                    descricao: '',
                    gherkin: ''
                };
                gherkinLines = [];
                inGherkin = false;
                continue;
            }

            if (!current) continue;

            if (upper.indexOf('EU,') === 0 || upper.indexOf('EU ') === 0) {
                current.descricao = clean;
                continue;
            }
            if (upper.indexOf('CRIT') === 0 || upper.indexOf('CENARIO') === 0 ||
                upper.indexOf('CENÁRIO') === 0 || upper.indexOf('DADO') === 0 ||
                upper.indexOf('QUANDO') === 0 || upper.indexOf('ENTÃO') === 0 ||
                upper.indexOf('ENTAO') === 0) {
                inGherkin = true;
            }
            if (inGherkin) gherkinLines.push(clean);
        }

        if (current) {
            current.gherkin = gherkinLines.join('\n').trim();
            stories.push(current);
        }
        return stories;
    }
})