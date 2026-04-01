public class ApontamentoDTO {
    public String   name;
    public Id       ownerId;
    public Datetime inicio;
    public Datetime fim;
    public Decimal  duracaoHoras;
    public String   observacoes;
    public Id       projeto;           // null por ora
    public Id       perfilDeAlocacao;  // null por ora
}
