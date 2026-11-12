using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using Estudae.Api.Conta;
using Estudae.Infra.Email;

namespace Estudae.Tests.Api;

// Caixa de entrada falsa: a API "envia" para cá, e o teste lê o e-mail e tira o
// link, como a pessoa faria.
public sealed partial class EmailsMemoria : IEnviadorEmail
{
    private readonly ConcurrentQueue<MensagemEmail> _caixa = new();

    public Task EnviarAsync(MensagemEmail mensagem, CancellationToken ct = default)
    {
        _caixa.Enqueue(mensagem);
        return Task.CompletedTask;
    }

    public List<MensagemEmail> Para(string email) => _caixa.Where(m => m.Para == email).ToList();

    // Usuário e token do último link para a rota (ex.: "/confirmar-email").
    public (string UsuarioId, string Token) UltimoLink(string email, string rota)
    {
        var link = Para(email)
            .SelectMany(m => Url().Matches(m.Texto).Select(x => x.Value))
            .Last(u => new Uri(u).AbsolutePath == rota);
        var query = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(new Uri(link).Query);
        return (query["u"].ToString(), query["t"].ToString());
    }

    public (string, string) UltimaConfirmacao(string email) => UltimoLink(email, LinksConta.RotaConfirmar);
    public (string, string) UltimaRedefinicao(string email) => UltimoLink(email, LinksConta.RotaRedefinir);

    [GeneratedRegex(@"https?://\S+")]
    private static partial Regex Url();
}
