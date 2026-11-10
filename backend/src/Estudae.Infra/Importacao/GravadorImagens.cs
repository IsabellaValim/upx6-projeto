using System.Security.Cryptography;
using Estudae.Domain.Conteudo;
using Estudae.Infra.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Estudae.Infra.Importacao;

public sealed class ResumoImagens
{
    public int Criadas { get; set; }
    public int Atualizadas { get; set; }
    public int Iguais { get; set; }
}

// Grava imagens de conteúdo na tabela imagem, pela chave natural Caminho.
// Igual ao importador de questões: reimportar atualiza (se os bytes mudaram) e
// nada é apagado. NÃO chama SaveChanges: quem chama decide quando gravar, para
// as imagens entrarem na mesma transação das questões que as usam.
public sealed class GravadorImagens(EstudaeDbContext db)
{
    // Os recortes da prova têm até ~200 KB; o limite só barra arquivo errado.
    public const int TamanhoMaximo = 2 * 1024 * 1024;

    public static string? TipoMime(string caminho) => Path.GetExtension(caminho).ToLowerInvariant() switch
    {
        ".webp" => "image/webp",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        _ => null,
    };

    // caminho = chave no banco (ex.: "2022/x.webp"); dados = bytes do arquivo.
    public async Task GravarAsync(IReadOnlyList<(string Caminho, byte[] Dados)> imagens, ResumoImagens resumo, CancellationToken ct = default)
    {
        var caminhos = imagens.Select(i => i.Caminho).ToList();
        var existentes = await db.Imagens
            .Where(i => caminhos.Contains(i.Caminho))
            .Select(i => new { i.Id, i.Caminho, i.Sha256 })
            .ToDictionaryAsync(i => i.Caminho, ct);

        var agora = DateTime.UtcNow;
        foreach (var (caminho, dados) in imagens)
        {
            var tipo = TipoMime(caminho) ?? throw new ArgumentException($"extensão não suportada: {caminho}");
            if (dados.Length == 0 || dados.Length > TamanhoMaximo)
                throw new ArgumentException($"{caminho}: tamanho inválido ({dados.Length} bytes; máximo {TamanhoMaximo})");
            var hash = Convert.ToHexStringLower(SHA256.HashData(dados));

            if (existentes.TryGetValue(caminho, out var atual))
            {
                if (atual.Sha256 == hash) { resumo.Iguais++; continue; }
                // Atualiza sem carregar os bytes antigos do banco.
                var img = new Imagem { Id = atual.Id };
                db.Imagens.Attach(img);
                img.TipoMime = tipo;
                img.Dados = dados;
                img.Sha256 = hash;
                img.AtualizadaEm = agora;
                resumo.Atualizadas++;
            }
            else
            {
                db.Imagens.Add(new Imagem { Caminho = caminho, TipoMime = tipo, Dados = dados, Sha256 = hash, AtualizadaEm = agora });
                resumo.Criadas++;
            }
        }
    }

    // Quais destes caminhos ainda não estão no banco.
    public async Task<List<string>> FaltandoAsync(IEnumerable<string> caminhos, CancellationToken ct = default)
    {
        var lista = caminhos.Distinct().ToList();
        var noBanco = await db.Imagens.Where(i => lista.Contains(i.Caminho)).Select(i => i.Caminho).ToListAsync(ct);
        return lista.Except(noBanco).ToList();
    }
}
