System.schedule(
    'Case SLA Tempo Restante - Horario',
    '0 0 * * * ?',
    new CaseSLATempoRestanteScheduler()
);
