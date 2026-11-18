using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Estudae.Infra.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Pedagogia : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "configuracao_pedagogica",
                columns: table => new
                {
                    disciplina_id = table.Column<int>(type: "integer", nullable: false),
                    versao_matriz = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    matriz_validada = table.Column<bool>(type: "boolean", nullable: false),
                    revisor = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    revisado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_configuracao_pedagogica", x => x.disciplina_id);
                    table.ForeignKey(
                        name: "fk_configuracao_pedagogica_disciplinas_disciplina_id",
                        column: x => x.disciplina_id,
                        principalTable: "disciplina",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "habilidade",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    tema_id = table.Column<int>(type: "integer", nullable: false),
                    slug = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    titulo = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    essencial = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    referencia_oficial = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    ordem = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_habilidade", x => x.id);
                    table.ForeignKey(
                        name: "fk_habilidade_temas_tema_id",
                        column: x => x.tema_id,
                        principalTable: "tema",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "metadados_questao",
                columns: table => new
                {
                    questao_id = table.Column<int>(type: "integer", nullable: false),
                    habilidade_principal_id = table.Column<int>(type: "integer", nullable: false),
                    familia = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    tipo = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    dificuldade = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    status_revisao = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    elegibilidade_solicitada = table.Column<bool>(type: "boolean", nullable: false),
                    conteudo_confere = table.Column<bool>(type: "boolean", nullable: false),
                    impressao_conteudo = table.Column<string>(type: "character(64)", fixedLength: true, maxLength: 64, nullable: true),
                    revisor = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    revisado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    versao = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_metadados_questao", x => x.questao_id);
                    table.CheckConstraint("ck_metadados_questao_dificuldade", "dificuldade IS NULL OR dificuldade IN ('introdutoria', 'intermediaria', 'avancada')");
                    table.CheckConstraint("ck_metadados_questao_status", "status_revisao IN ('pendente', 'aprovada', 'rejeitada')");
                    table.ForeignKey(
                        name: "fk_metadados_questao_habilidade_habilidade_principal_id",
                        column: x => x.habilidade_principal_id,
                        principalTable: "habilidade",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_metadados_questao_questao",
                        column: x => x.questao_id,
                        principalTable: "questao",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "videoaula_habilidade",
                columns: table => new
                {
                    videoaula_id = table.Column<int>(type: "integer", nullable: false),
                    habilidade_id = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_videoaula_habilidade", x => new { x.videoaula_id, x.habilidade_id });
                    table.ForeignKey(
                        name: "fk_videoaula_habilidade_habilidade_habilidade_id",
                        column: x => x.habilidade_id,
                        principalTable: "habilidade",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_videoaula_habilidade_videoaula_videoaula_id",
                        column: x => x.videoaula_id,
                        principalTable: "videoaula",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "questao_habilidade_secundaria",
                columns: table => new
                {
                    questao_id = table.Column<int>(type: "integer", nullable: false),
                    habilidade_id = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_questao_habilidade_secundaria", x => new { x.questao_id, x.habilidade_id });
                    table.ForeignKey(
                        name: "fk_questao_habilidade_secundaria_habilidade_habilidade_id",
                        column: x => x.habilidade_id,
                        principalTable: "habilidade",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_questao_habilidade_secundaria_metadados_questao_questao_id",
                        column: x => x.questao_id,
                        principalTable: "metadados_questao",
                        principalColumn: "questao_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_habilidade_tema_id_slug",
                table: "habilidade",
                columns: new[] { "tema_id", "slug" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_metadados_questao_familia",
                table: "metadados_questao",
                column: "familia");

            migrationBuilder.CreateIndex(
                name: "ix_metadados_questao_habilidade_principal_id",
                table: "metadados_questao",
                column: "habilidade_principal_id");

            migrationBuilder.CreateIndex(
                name: "ix_questao_habilidade_secundaria_habilidade_id",
                table: "questao_habilidade_secundaria",
                column: "habilidade_id");

            migrationBuilder.CreateIndex(
                name: "ix_videoaula_habilidade_habilidade_id",
                table: "videoaula_habilidade",
                column: "habilidade_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "configuracao_pedagogica");

            migrationBuilder.DropTable(
                name: "questao_habilidade_secundaria");

            migrationBuilder.DropTable(
                name: "videoaula_habilidade");

            migrationBuilder.DropTable(
                name: "metadados_questao");

            migrationBuilder.DropTable(
                name: "habilidade");
        }
    }
}
