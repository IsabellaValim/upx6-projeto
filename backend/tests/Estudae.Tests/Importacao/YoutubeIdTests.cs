using Estudae.Infra.Importacao;

namespace Estudae.Tests.Importacao;

public class YoutubeIdTests
{
    private const string Id = "dQw4w9WgX_-";

    [Theory]
    [InlineData(Id)]
    [InlineData("  " + Id + "  ")]
    [InlineData("https://www.youtube.com/watch?v=" + Id)]
    [InlineData("https://www.youtube.com/watch?v=" + Id + "&t=30s")]
    [InlineData("https://www.youtube.com/watch?feature=share&v=" + Id)]
    [InlineData("https://m.youtube.com/watch?v=" + Id)]
    [InlineData("http://youtube.com/watch?v=" + Id)]
    [InlineData("youtube.com/watch?v=" + Id)]
    [InlineData("https://youtu.be/" + Id)]
    [InlineData("https://youtu.be/" + Id + "?si=abc123")]
    [InlineData("youtu.be/" + Id)]
    [InlineData("https://www.youtube.com/embed/" + Id)]
    [InlineData("https://www.youtube-nocookie.com/embed/" + Id + "?rel=0")]
    [InlineData("https://www.youtube.com/shorts/" + Id)]
    [InlineData("https://www.youtube.com/live/" + Id)]
    public void Extrai_o_id(string entrada)
    {
        Assert.True(YoutubeId.TentarExtrair(entrada, out var id));
        Assert.Equal(Id, id);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("curto")]
    [InlineData("dQw4w9WgXcQx")]                               // 12 caracteres
    [InlineData("dQw4w9WgX!Q")]                                // caractere inválido
    [InlineData("https://vimeo.com/123456789")]
    [InlineData("https://www.youtube.com/watch?v=curto")]
    [InlineData("https://www.youtube.com/results?search_query=porcentagem")]
    [InlineData("https://www.youtube.com/@canal")]
    [InlineData("https://youtube.com.golpe.example/watch?v=dQw4w9WgXcQ")]
    public void Recusa_o_que_nao_e_video_do_youtube(string? entrada)
    {
        Assert.False(YoutubeId.TentarExtrair(entrada, out _));
    }
}
