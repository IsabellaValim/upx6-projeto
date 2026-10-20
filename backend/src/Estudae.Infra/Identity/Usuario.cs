using Microsoft.AspNetCore.Identity;

namespace Estudae.Infra.Identity;

// Mora na Infra (e não no Domain) porque herda de IdentityUser, que é pacote de
// framework. O Domain referencia o usuário só pelo id (string UsuarioId).
public class Usuario : IdentityUser
{
    public string Nome { get; set; } = string.Empty;
}
