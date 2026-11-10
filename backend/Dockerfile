# Imagem da API do Estudae (fase 4).
#
# Build context = RAIZ do repositorio (nao backend/), por isso os caminhos
# abaixo comecam com backend/. O que entra no context e filtrado pelo
# .dockerignore da raiz.
#
#   docker build -f backend/Dockerfile -t estudae-api .
#
# Dois estagios: o SDK compila, o runtime executa. A imagem final e so a do
# ultimo estagio; SDK, codigo-fonte e cache do NuGet ficam para tras.

# ---------------------------------------------------------------------------
# Estagio 1: build (SDK completo: compilador, MSBuild, NuGet)
# ---------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Primeiro so o que o restore precisa: global.json e os .csproj.
# Enquanto nenhum deles mudar, a camada do restore vem do cache e os pacotes
# nao sao baixados de novo, mesmo que o codigo C# mude.
COPY backend/global.json backend/
COPY backend/src/Estudae.Domain/Estudae.Domain.csproj backend/src/Estudae.Domain/
COPY backend/src/Estudae.Infra/Estudae.Infra.csproj   backend/src/Estudae.Infra/
COPY backend/src/Estudae.Api/Estudae.Api.csproj       backend/src/Estudae.Api/

WORKDIR /src/backend
# Restaurar a Api restaura junto os projetos que ela referencia (Infra, Domain).
RUN dotnet restore src/Estudae.Api/Estudae.Api.csproj

# Agora o resto do codigo. Daqui para baixo, qualquer mudanca num .cs refaz
# so estas camadas.
COPY backend/src/ src/

# --no-restore: o restore ja foi feito acima (e esta no cache).
# UseAppHost=false: nao gera o executavel nativo; o ENTRYPOINT usa "dotnet <dll>".
RUN dotnet publish src/Estudae.Api/Estudae.Api.csproj \
    -c Release \
    -o /app/publish \
    --no-restore \
    /p:UseAppHost=false

# ---------------------------------------------------------------------------
# Estagio 2: final (so o runtime do ASP.NET Core)
# ---------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# A imagem ja define ASPNETCORE_HTTP_PORTS=8080. Kestrel fala so HTTP aqui
# dentro; o HTTPS termina no proxy da frente (Caddy na VM ou a borda do
# Render, conforme o deploy escolhido).
# EXPOSE e documentacao: quem publica a porta e o "ports:" do compose.
EXPOSE 8080

# Do estagio de build vem so o resultado do publish.
COPY --from=build /app/publish .

# Front (HTML/CSS/JS puro, sem build): direto do context para o wwwroot, que a
# API serve com UseStaticFiles. Ficam depois do publish de proposito: mudar
# so o front refaz so estas camadas, sem recompilar o C#.
COPY index.html wwwroot/
COPY src/ wwwroot/src/

# Conteudo (questoes, videos, imagens) NAO vai na imagem: mora no banco. Para
# importar um JSON novo, monte a pasta dele no container (ver docs/conteudo/README.md).

# Usuario sem privilegios que ja existe na imagem (APP_UID e definido nela).
# Sem esta linha o processo rodaria como root.
USER $APP_UID

ENTRYPOINT ["dotnet", "Estudae.Api.dll"]
