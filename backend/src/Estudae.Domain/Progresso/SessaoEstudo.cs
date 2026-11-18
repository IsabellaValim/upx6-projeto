using Estudae.Domain.Conteudo;

namespace Estudae.Domain.Progresso;

// Uma lição (um tema) ou um simulado (a disciplina toda) que o aluno terminou.
// Só sessão concluída é gravada: a que está em andamento vive só na tela.
// Nada derivado fica aqui: acertos, total, tempo usado (ConcluidaEm - IniciadaEm)
// e tema mais fraco saem das tentativas e das datas.
public class SessaoEstudo
{
    public long Id { get; set; }

    // Dono da sessão. O Domain não conhece o usuário do Identity, só o id; a FK
    // (com cascade ao excluir a conta) fica na configuração da Infra.
    public string UsuarioId { get; set; } = string.Empty;

    // TipoSessao.Licao ou TipoSessao.Simulado.
    public string Tipo { get; set; } = TipoSessao.Licao;

    public int DisciplinaId { get; set; }
    public Disciplina Disciplina { get; set; } = null!;

    // Só na lição (o banco garante: lição tem tema, simulado não).
    public int? TemaId { get; set; }
    public Tema? Tema { get; set; }

    // Simulado montado com questões autorais por falta de oficiais suficientes.
    public bool Treino { get; set; }

    public DateTime IniciadaEm { get; set; }
    public DateTime ConcluidaEm { get; set; }

    // Tempo dado ao simulado. Nulo na lição, que não tem relógio.
    public int? TempoLimiteSeg { get; set; }

    public List<Tentativa> Tentativas { get; set; } = [];
}

public static class TipoSessao
{
    public const string Licao = "licao";
    public const string Simulado = "simulado";
    public static readonly string[] Todos = [Licao, Simulado];
}
