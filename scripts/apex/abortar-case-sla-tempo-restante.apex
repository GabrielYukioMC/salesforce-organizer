for (CronTrigger job : [
    SELECT Id
    FROM CronTrigger
    WHERE CronJobDetail.Name = 'Case SLA Tempo Restante - Horario'
]) {
    System.abortJob(job.Id);
}
