using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Estudae.Api.Endpoints;

// Erro simples e previsível para o front: { "erro": "mensagem para mostrar" }.
public sealed record ProblemaDto(string Erro);

public static class Erros
{
    // JSON malformado no corpo vira exceção (em vez de um 400 vazio) para cair no
    // tratador abaixo e sair no mesmo formato em qualquer ambiente.
    public static IServiceCollection AddErrosPadronizados(this IServiceCollection services) =>
        services.Configure<RouteHandlerOptions>(o => o.ThrowOnBadRequest = true);

    // Toda exceção sai como { "erro": ... }; stack trace nunca vai para o cliente.
    public static IApplicationBuilder UseErrosPadronizados(this IApplicationBuilder app) =>
        app.UseExceptionHandler(e => e.Run(async ctx =>
        {
            var ex = ctx.Features.Get<IExceptionHandlerFeature>()?.Error;
            var (status, mensagem) = ex is BadHttpRequestException bad
                ? (bad.StatusCode, "Requisição inválida: o corpo precisa ser JSON no formato do contrato.")
                : (StatusCodes.Status500InternalServerError, "Erro interno. Tente de novo em instantes.");
            ctx.Response.StatusCode = status;
            await ctx.Response.WriteAsJsonAsync(new ProblemaDto(mensagem));
        }));
}
