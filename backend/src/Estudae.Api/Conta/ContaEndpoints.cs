using Estudae.Api.Endpoints;
using Estudae.Infra.Email;
using Estudae.Infra.Identity;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;

namespace Estudae.Api.Conta;

// Conta do aluno (contrato em docs/api.md). Sessão por cookie HttpOnly
// (ver ConfiguracaoConta).
//
// Regra de privacidade: a API nunca revela se um e-mail tem conta.
// - cadastro, reenviar e "esqueci a senha" respondem sempre 202, exista o
//   e-mail ou não (o dono de uma conta já existente recebe um aviso por e-mail);
// - login com e-mail inexistente ou senha errada dá a mesma mensagem;
// - "falta confirmar o e-mail" só aparece depois de a senha estar certa.
// Por isso o login não usa SignInManager.PasswordSignInAsync: ele checa a
// confirmação ANTES da senha, e diria "falta confirmar" a quem chutou uma senha.
public static class ContaEndpoints
{
    // ---- DTOs ----
    public sealed record CadastroRequest(string? Nome, string? Email, string? Senha);
    public sealed record EntrarRequest(string? Email, string? Senha);
    public sealed record EmailRequest(string? Email);
    public sealed record ConfirmarRequest(string? UsuarioId, string? Token);
    public sealed record RedefinirRequest(string? UsuarioId, string? Token, string? Senha);
    public sealed record SenhaRequest(string? Senha);

    public sealed record UsuarioDto(string Nome, string Email);
    public sealed record MensagemDto(string Mensagem);
    public sealed record OpcoesDto(bool CadastroAberto);
    // Erro com código, para o front reagir (ex.: mostrar "reenviar e-mail").
    public sealed record ProblemaCodigoDto(string Erro, string Codigo);

    public const string CodigoEmailNaoConfirmado = "email-nao-confirmado";

    private const string ErroCredenciais = "E-mail ou senha incorretos.";
    private const string ErroLink = "Este link não vale mais. Peça um novo e-mail.";
    private const string ErroBloqueio = "Muitas tentativas erradas. Espere 5 minutos e tente de novo.";
    private const string ErroCadastroFechado =
        "O cadastro de contas ainda não está disponível. Você pode continuar usando o Estudaê como visitante.";
    private const string ErroEnvio = "Não conseguimos enviar o e-mail agora. Tente de novo em alguns minutos.";

    public static void MapConta(this IEndpointRouteBuilder app)
    {
        var conta = app.MapGroup("/api/conta");
        conta.MapGet("/opcoes", (ConfigConta c) => new OpcoesDto(c.CadastroAberto));
        conta.MapPost("/cadastro", Cadastrar);
        conta.MapPost("/confirmar-email", ConfirmarEmail);
        conta.MapPost("/reenviar-confirmacao", ReenviarConfirmacao);
        conta.MapPost("/entrar", Entrar);
        conta.MapPost("/sair", Sair);
        conta.MapGet("/eu", Eu).RequireAuthorization();
        conta.MapPost("/esqueci-senha", EsqueciSenha);
        conta.MapPost("/redefinir-senha", RedefinirSenha);
        conta.MapPost("/excluir", Excluir).RequireAuthorization();
    }

    private static UsuarioDto Dto(Usuario u) => new(u.Nome, u.Email!);
    private static BadRequest<ProblemaDto> Invalido(string erro) => TypedResults.BadRequest(new ProblemaDto(erro));
    private static ProblemaDto Erro(string erro) => new(erro);
    private static JsonHttpResult<ProblemaDto> Status(int status, string erro) =>
        TypedResults.Json(Erro(erro), statusCode: status);

    // ---- cadastro ----

    private static async Task<IResult> Cadastrar(
        CadastroRequest corpo, UserManager<Usuario> usuarios, ConfigConta config,
        IEnviadorEmail email, ILogger<Usuario> log)
    {
        if (!config.CadastroAberto) return Status(StatusCodes.Status503ServiceUnavailable, ErroCadastroFechado);

        var (nome, erroNome) = ValidacaoConta.Nome(corpo.Nome);
        if (erroNome is not null) return Invalido(erroNome);
        var (endereco, erroEmail) = ValidacaoConta.Email(corpo.Email);
        if (erroEmail is not null) return Invalido(erroEmail);
        if (ValidacaoConta.Senha(corpo.Senha) is { } erroSenha) return Invalido(erroSenha);

        // A senha é validada ANTES de procurar o e-mail: assim uma senha curta
        // dá o mesmo erro com ou sem conta existente.
        var candidato = new Usuario { UserName = endereco, Email = endereco, Nome = nome! };
        if (await ValidarSenha(usuarios, candidato, corpo.Senha!) is { } erroPolitica) return Invalido(erroPolitica);

        var existente = await usuarios.FindByEmailAsync(endereco!);
        try
        {
            if (existente is null)
            {
                var criado = await usuarios.CreateAsync(candidato, corpo.Senha!);
                if (!criado.Succeeded) return Invalido(criado.Errors.First().Description);
                await EnviarConfirmacao(usuarios, config, email, candidato);
            }
            // Já existe: não muda nome nem senha (senão qualquer um trocaria a
            // senha de uma conta não confirmada). Só reenvia ou avisa o dono.
            else if (!existente.EmailConfirmed)
                await EnviarConfirmacao(usuarios, config, email, existente);
            else
                await email.EnviarAsync(EmailsConta.ContaJaExiste(existente.Nome, existente.Email!,
                    LinksConta.Entrar(config.UrlPublica), LinksConta.Esqueci(config.UrlPublica)));
        }
        catch (EnvioEmailException ex)
        {
            log.LogError(ex, "Falha ao enviar e-mail de cadastro");
            return Status(StatusCodes.Status503ServiceUnavailable, ErroEnvio);
        }

        return TypedResults.Accepted((string?)null, new MensagemDto(
            $"Enviamos um e-mail para {endereco}. Abra o e-mail e toque no botão para confirmar."));
    }

    private static async Task<IResult> ConfirmarEmail(
        ConfirmarRequest corpo, UserManager<Usuario> usuarios, SignInManager<Usuario> sessao)
    {
        var token = LinksConta.Decodificar(corpo.Token);
        var usuario = string.IsNullOrWhiteSpace(corpo.UsuarioId) ? null : await usuarios.FindByIdAsync(corpo.UsuarioId);
        if (token is null || usuario is null) return Invalido(ErroLink);

        var r = await usuarios.ConfirmEmailAsync(usuario, token);
        if (!r.Succeeded) return Invalido(ErroLink);

        // O link prova que a pessoa tem acesso ao e-mail: já entra direto.
        await sessao.SignInAsync(usuario, isPersistent: true);
        return TypedResults.Ok(Dto(usuario));
    }

    private static async Task<IResult> ReenviarConfirmacao(
        EmailRequest corpo, UserManager<Usuario> usuarios, ConfigConta config,
        IEnviadorEmail email, ILogger<Usuario> log)
    {
        if (!config.CadastroAberto) return Status(StatusCodes.Status503ServiceUnavailable, ErroCadastroFechado);
        var (endereco, erro) = ValidacaoConta.Email(corpo.Email);
        if (erro is not null) return Invalido(erro);

        var usuario = await usuarios.FindByEmailAsync(endereco!);
        if (usuario is { EmailConfirmed: false })
        {
            try { await EnviarConfirmacao(usuarios, config, email, usuario); }
            catch (EnvioEmailException ex)
            {
                log.LogError(ex, "Falha ao reenviar confirmação");
                return Status(StatusCodes.Status503ServiceUnavailable, ErroEnvio);
            }
        }
        return TypedResults.Accepted((string?)null, new MensagemDto(
            $"Se existir uma conta esperando confirmação com {endereco}, enviamos o e-mail de novo."));
    }

    // ---- sessão ----

    private static async Task<IResult> Entrar(
        EntrarRequest corpo, UserManager<Usuario> usuarios, SignInManager<Usuario> sessao)
    {
        var (endereco, erroEmail) = ValidacaoConta.Email(corpo.Email);
        if (erroEmail is not null) return Invalido(erroEmail);
        if (ValidacaoConta.Senha(corpo.Senha) is { } erroSenha) return Invalido(erroSenha);

        var usuario = await usuarios.FindByEmailAsync(endereco!);
        if (usuario is null) return Status(StatusCodes.Status401Unauthorized, ErroCredenciais);
        if (await usuarios.IsLockedOutAsync(usuario)) return Status(StatusCodes.Status429TooManyRequests, ErroBloqueio);

        if (!await usuarios.CheckPasswordAsync(usuario, corpo.Senha!))
        {
            await usuarios.AccessFailedAsync(usuario); // conta o erro; no 5º, bloqueia
            return await usuarios.IsLockedOutAsync(usuario)
                ? Status(StatusCodes.Status429TooManyRequests, ErroBloqueio)
                : Status(StatusCodes.Status401Unauthorized, ErroCredenciais);
        }

        // Daqui para baixo a senha está certa: pode dizer o que falta.
        if (!usuario.EmailConfirmed)
            return TypedResults.Json(new ProblemaCodigoDto(
                "Falta confirmar seu e-mail. Abra o e-mail que enviamos e toque no botão.",
                CodigoEmailNaoConfirmado), statusCode: StatusCodes.Status403Forbidden);

        await usuarios.ResetAccessFailedCountAsync(usuario);
        await sessao.SignInAsync(usuario, isPersistent: true);
        return TypedResults.Ok(Dto(usuario));
    }

    private static async Task<NoContent> Sair(SignInManager<Usuario> sessao)
    {
        await sessao.SignOutAsync();
        return TypedResults.NoContent();
    }

    private static async Task<IResult> Eu(HttpContext http, UserManager<Usuario> usuarios)
    {
        // Cookie válido de uma conta que foi excluída: trata como deslogado.
        var usuario = await usuarios.GetUserAsync(http.User);
        return usuario is null
            ? Status(StatusCodes.Status401Unauthorized, "Você precisa entrar na sua conta.")
            : TypedResults.Ok(Dto(usuario));
    }

    // ---- senha ----

    private static async Task<IResult> EsqueciSenha(
        EmailRequest corpo, UserManager<Usuario> usuarios, ConfigConta config,
        IEnviadorEmail email, ILogger<Usuario> log)
    {
        if (!config.CadastroAberto) return Status(StatusCodes.Status503ServiceUnavailable, ErroCadastroFechado);
        var (endereco, erro) = ValidacaoConta.Email(corpo.Email);
        if (erro is not null) return Invalido(erro);

        var usuario = await usuarios.FindByEmailAsync(endereco!);
        if (usuario is not null)
        {
            var token = await usuarios.GeneratePasswordResetTokenAsync(usuario);
            var link = LinksConta.Redefinicao(config.UrlPublica, usuario.Id, token);
            try { await email.EnviarAsync(EmailsConta.Redefinicao(usuario.Nome, usuario.Email!, link)); }
            catch (EnvioEmailException ex)
            {
                log.LogError(ex, "Falha ao enviar redefinição de senha");
                return Status(StatusCodes.Status503ServiceUnavailable, ErroEnvio);
            }
        }
        return TypedResults.Accepted((string?)null, new MensagemDto(
            $"Se existir uma conta com {endereco}, enviamos um e-mail com o link para criar uma senha nova."));
    }

    private static async Task<IResult> RedefinirSenha(
        RedefinirRequest corpo, UserManager<Usuario> usuarios, SignInManager<Usuario> sessao)
    {
        if (ValidacaoConta.Senha(corpo.Senha) is { } erroSenha) return Invalido(erroSenha);
        var token = LinksConta.Decodificar(corpo.Token);
        var usuario = string.IsNullOrWhiteSpace(corpo.UsuarioId) ? null : await usuarios.FindByIdAsync(corpo.UsuarioId);
        if (token is null || usuario is null) return Invalido(ErroLink);

        // ResetPasswordAsync valida o token, aplica a política de senha e troca o
        // security stamp: as sessões abertas em outros aparelhos deixam de valer.
        var r = await usuarios.ResetPasswordAsync(usuario, token, corpo.Senha!);
        if (!r.Succeeded)
        {
            var e = r.Errors.First();
            return Invalido(e.Code == nameof(IdentityErrorDescriber.InvalidToken) ? ErroLink : e.Description);
        }

        // O link chegou pelo e-mail, então o e-mail está provado; e quem trocou a
        // senha não deve continuar bloqueado pelas tentativas antigas.
        if (!usuario.EmailConfirmed)
        {
            usuario.EmailConfirmed = true;
            await usuarios.UpdateAsync(usuario);
        }
        await usuarios.ResetAccessFailedCountAsync(usuario);
        await usuarios.SetLockoutEndDateAsync(usuario, null);

        await sessao.SignInAsync(usuario, isPersistent: true);
        return TypedResults.Ok(Dto(usuario));
    }

    // ---- excluir conta (LGPD: a pessoa pode apagar os próprios dados) ----

    private static async Task<IResult> Excluir(
        SenhaRequest corpo, HttpContext http, UserManager<Usuario> usuarios, SignInManager<Usuario> sessao)
    {
        var usuario = await usuarios.GetUserAsync(http.User);
        if (usuario is null) return Status(StatusCodes.Status401Unauthorized, "Você precisa entrar na sua conta.");

        // Pede a senha de novo: um celular desbloqueado na mão de outra pessoa
        // não basta para apagar a conta.
        if (string.IsNullOrEmpty(corpo.Senha) || !await usuarios.CheckPasswordAsync(usuario, corpo.Senha))
            return Status(StatusCodes.Status401Unauthorized, "Senha incorreta.");

        var r = await usuarios.DeleteAsync(usuario);
        if (!r.Succeeded) return Status(StatusCodes.Status500InternalServerError, r.Errors.First().Description);

        await sessao.SignOutAsync();
        return TypedResults.NoContent();
    }

    // ---- apoio ----

    private static async Task EnviarConfirmacao(
        UserManager<Usuario> usuarios, ConfigConta config, IEnviadorEmail email, Usuario usuario)
    {
        var token = await usuarios.GenerateEmailConfirmationTokenAsync(usuario);
        var link = LinksConta.Confirmacao(config.UrlPublica, usuario.Id, token);
        await email.EnviarAsync(EmailsConta.Confirmacao(usuario.Nome, usuario.Email!, link));
    }

    // Roda os validadores de senha do Identity (comprimento da PoliticaConta)
    // sem criar o usuário. Devolve a primeira mensagem, já em português.
    private static async Task<string?> ValidarSenha(UserManager<Usuario> usuarios, Usuario usuario, string senha)
    {
        foreach (var v in usuarios.PasswordValidators)
        {
            var r = await v.ValidateAsync(usuarios, usuario, senha);
            if (!r.Succeeded) return r.Errors.First().Description;
        }
        return null;
    }
}
