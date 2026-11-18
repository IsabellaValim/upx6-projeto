using Estudae.Infra.Email;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Estudae.Tests.Conta;

public class EnviadorEmailLimitadoTests
{
    private sealed class EnviadorFalso : IEnviadorEmail
    {
        public List<string> Enviados { get; } = [];

        public Task EnviarAsync(MensagemEmail m, CancellationToken ct = default)
        {
            Enviados.Add(m.Para);
            return Task.CompletedTask;
        }
    }

    private static (EnviadorEmailLimitado, EnviadorFalso) Montar(int porDestinatario = 3, int porDia = 90)
    {
        var falso = new EnviadorFalso();
        var limites = new LimitadorEmail(Options.Create(new OpcoesLimiteEmail
        {
            PorDestinatarioPorHora = porDestinatario,
            PorDia = porDia,
        }));
        return (new EnviadorEmailLimitado(falso, limites, NullLogger<EnviadorEmailLimitado>.Instance), falso);
    }

    private static MensagemEmail Para(string email) => new(email, "Assunto", "<p>Oi</p>", "Oi");

    [Fact]
    public async Task Acima_do_limite_por_destinatario_nao_envia_e_nao_lanca()
    {
        var (enviador, falso) = Montar(porDestinatario: 3);

        for (var i = 0; i < 4; i++) await enviador.EnviarAsync(Para("maria@gmail.com"));

        Assert.Equal(3, falso.Enviados.Count);
    }

    [Fact]
    public async Task Limite_por_destinatario_ignora_maiusculas_e_espacos()
    {
        var (enviador, falso) = Montar(porDestinatario: 1);

        await enviador.EnviarAsync(Para("maria@gmail.com"));
        await enviador.EnviarAsync(Para(" Maria@Gmail.com "));

        Assert.Single(falso.Enviados);
    }

    [Fact]
    public async Task Outro_destinatario_tem_a_propria_cota()
    {
        var (enviador, falso) = Montar(porDestinatario: 1);

        await enviador.EnviarAsync(Para("maria@gmail.com"));
        await enviador.EnviarAsync(Para("maria@gmail.com"));
        await enviador.EnviarAsync(Para("jose@gmail.com"));

        Assert.Equal(["maria@gmail.com", "jose@gmail.com"], falso.Enviados);
    }

    [Fact]
    public async Task Acima_do_teto_diario_nao_envia_para_ninguem()
    {
        var (enviador, falso) = Montar(porDia: 2);

        await enviador.EnviarAsync(Para("a@gmail.com"));
        await enviador.EnviarAsync(Para("b@gmail.com"));
        await enviador.EnviarAsync(Para("c@gmail.com"));

        Assert.Equal(["a@gmail.com", "b@gmail.com"], falso.Enviados);
    }

    [Fact]
    public async Task Destinatario_bloqueado_nao_gasta_a_cota_do_dia()
    {
        var (enviador, falso) = Montar(porDestinatario: 1, porDia: 2);

        await enviador.EnviarAsync(Para("a@gmail.com"));
        await enviador.EnviarAsync(Para("a@gmail.com")); // barrado pelo destinatário
        await enviador.EnviarAsync(Para("b@gmail.com"));

        Assert.Equal(["a@gmail.com", "b@gmail.com"], falso.Enviados);
    }
}
