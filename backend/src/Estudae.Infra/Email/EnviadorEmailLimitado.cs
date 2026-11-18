using System.Threading.RateLimiting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Estudae.Infra.Email;

// Seção "Email:Limites" (em container: Email__Limites__PorDia etc.).
public sealed class OpcoesLimiteEmail
{
    // E-mails para o MESMO endereço numa hora (cadastro, reenviar, esqueci somados).
    public int PorDestinatarioPorHora { get; set; } = 3;

    // Todos os e-mails em 24 horas. Abaixo dos 100/dia do plano grátis do Resend.
    public int PorDia { get; set; } = 90;
}

// Estado dos limites: um só por processo (singleton). Fica em memória, então
// reiniciar a API zera a contagem (uma instância só no Render: custo aceito).
public sealed class LimitadorEmail : IDisposable
{
    private readonly PartitionedRateLimiter<string> _porDestinatario;
    private readonly FixedWindowRateLimiter _porDia;

    public LimitadorEmail(IOptions<OpcoesLimiteEmail> opcoes)
    {
        var o = opcoes.Value;
        _porDestinatario = PartitionedRateLimiter.Create<string, string>(para =>
            RateLimitPartition.GetFixedWindowLimiter(para, _ => Janela(o.PorDestinatarioPorHora, TimeSpan.FromHours(1))));
        _porDia = new FixedWindowRateLimiter(Janela(o.PorDia, TimeSpan.FromDays(1)));
    }

    private static FixedWindowRateLimiterOptions Janela(int limite, TimeSpan janela) => new()
    {
        PermitLimit = limite,
        Window = janela,
        QueueLimit = 0,
        AutoReplenishment = true,
    };

    // Primeiro o destinatário: um endereço bloqueado não gasta a cota do dia.
    public bool PodeEnviar(string para, out string? motivo)
    {
        using var porPara = _porDestinatario.AttemptAcquire(para.Trim().ToLowerInvariant());
        if (!porPara.IsAcquired)
        {
            motivo = "limite por destinatário";
            return false;
        }

        using var porDia = _porDia.AttemptAcquire();
        motivo = porDia.IsAcquired ? null : "limite diário";
        return porDia.IsAcquired;
    }

    public void Dispose()
    {
        _porDestinatario.Dispose();
        _porDia.Dispose();
    }
}

// Embrulha o enviador de verdade. Protege o domínio (spam para terceiros) e a
// cota do Resend, sem depender do IP de quem chama, que dá para forjar.
//
// Acima do limite o e-mail simplesmente NÃO sai, sem erro: os endpoints
// continuam respondendo 202, como sempre. Um erro aqui viraria 503 só para
// e-mails que têm conta (reenviar e "esqueci" não enviam nada aos outros) e
// revelaria quem tem conta. Quem precisar, pede de novo mais tarde.
public sealed class EnviadorEmailLimitado(
    IEnviadorEmail interno, LimitadorEmail limites, ILogger<EnviadorEmailLimitado> log) : IEnviadorEmail
{
    public Task EnviarAsync(MensagemEmail mensagem, CancellationToken ct = default)
    {
        if (limites.PodeEnviar(mensagem.Para, out var motivo))
            return interno.EnviarAsync(mensagem, ct);

        // Sem o endereço no log.
        log.LogWarning("E-mail não enviado ({Motivo}). Assunto: {Assunto}", motivo, mensagem.Assunto);
        return Task.CompletedTask;
    }
}
