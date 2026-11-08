using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Estudae.Infra.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Conteudo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "disciplina",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    nome = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    slug = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    icone = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_disciplina", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "tema",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    disciplina_id = table.Column<int>(type: "integer", nullable: false),
                    slug = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    titulo = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    sobre = table.Column<string>(type: "text", nullable: false),
                    ordem = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tema", x => x.id);
                    table.ForeignKey(
                        name: "fk_tema_disciplina_disciplina_id",
                        column: x => x.disciplina_id,
                        principalTable: "disciplina",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "questao",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    codigo = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    tema_id = table.Column<int>(type: "integer", nullable: false),
                    texto_base = table.Column<string>(type: "text", nullable: true),
                    enunciado = table.Column<string>(type: "text", nullable: false),
                    alternativas = table.Column<List<string>>(type: "text[]", nullable: false),
                    resposta_correta = table.Column<string>(type: "text", nullable: false),
                    resolucao = table.Column<string>(type: "text", nullable: false),
                    imagem_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    prova_ano = table.Column<int>(type: "integer", nullable: true),
                    prova_edicao = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    prova_nivel = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    prova_numero = table.Column<int>(type: "integer", nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_questao", x => x.id);
                    table.CheckConstraint("ck_questao_status", "status IN ('rascunho', 'publicada')");
                    table.ForeignKey(
                        name: "fk_questao_tema_tema_id",
                        column: x => x.tema_id,
                        principalTable: "tema",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "videoaula",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    tema_id = table.Column<int>(type: "integer", nullable: false),
                    titulo = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    youtube_id = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: false),
                    tipo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    duracao_segundos = table.Column<int>(type: "integer", nullable: true),
                    ordem = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_videoaula", x => x.id);
                    table.ForeignKey(
                        name: "fk_videoaula_tema_tema_id",
                        column: x => x.tema_id,
                        principalTable: "tema",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_disciplina_slug",
                table: "disciplina",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_questao_codigo",
                table: "questao",
                column: "codigo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_questao_tema_id_status",
                table: "questao",
                columns: new[] { "tema_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_tema_disciplina_id_slug",
                table: "tema",
                columns: new[] { "disciplina_id", "slug" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_videoaula_tema_id_youtube_id",
                table: "videoaula",
                columns: new[] { "tema_id", "youtube_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "questao");

            migrationBuilder.DropTable(
                name: "videoaula");

            migrationBuilder.DropTable(
                name: "tema");

            migrationBuilder.DropTable(
                name: "disciplina");
        }
    }
}
