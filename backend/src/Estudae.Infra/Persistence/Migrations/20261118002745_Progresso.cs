using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Estudae.Infra.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Progresso : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "aula_assistida",
                columns: table => new
                {
                    usuario_id = table.Column<string>(type: "text", nullable: false),
                    videoaula_id = table.Column<int>(type: "integer", nullable: false),
                    assistida_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_aula_assistida", x => new { x.usuario_id, x.videoaula_id });
                    table.ForeignKey(
                        name: "fk_aula_assistida_usuario_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuario",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_aula_assistida_videoaula_videoaula_id",
                        column: x => x.videoaula_id,
                        principalTable: "videoaula",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "sessao_estudo",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    usuario_id = table.Column<string>(type: "text", nullable: false),
                    tipo = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    disciplina_id = table.Column<int>(type: "integer", nullable: false),
                    tema_id = table.Column<int>(type: "integer", nullable: true),
                    treino = table.Column<bool>(type: "boolean", nullable: false),
                    iniciada_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    concluida_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    tempo_limite_seg = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sessao_estudo", x => x.id);
                    table.CheckConstraint("ck_sessao_estudo_datas", "concluida_em >= iniciada_em");
                    table.CheckConstraint("ck_sessao_estudo_tema", "(tipo = 'licao') = (tema_id IS NOT NULL)");
                    table.CheckConstraint("ck_sessao_estudo_tempo_limite", "tempo_limite_seg IS NULL OR (tipo = 'simulado' AND tempo_limite_seg > 0)");
                    table.CheckConstraint("ck_sessao_estudo_tipo", "tipo IN ('licao', 'simulado')");
                    table.ForeignKey(
                        name: "fk_sessao_estudo_disciplina_disciplina_id",
                        column: x => x.disciplina_id,
                        principalTable: "disciplina",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_sessao_estudo_tema_tema_id",
                        column: x => x.tema_id,
                        principalTable: "tema",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_sessao_estudo_usuario_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuario",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tentativa",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    sessao_estudo_id = table.Column<long>(type: "bigint", nullable: false),
                    questao_id = table.Column<int>(type: "integer", nullable: false),
                    ordem = table.Column<short>(type: "smallint", nullable: false),
                    alternativa_escolhida = table.Column<string>(type: "text", nullable: true),
                    acertou = table.Column<bool>(type: "boolean", nullable: false),
                    respondida_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tentativa", x => x.id);
                    table.CheckConstraint("ck_tentativa_ordem", "ordem > 0");
                    table.ForeignKey(
                        name: "fk_tentativa_questao_questao_id",
                        column: x => x.questao_id,
                        principalTable: "questao",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_tentativa_sessao_estudo_sessao_estudo_id",
                        column: x => x.sessao_estudo_id,
                        principalTable: "sessao_estudo",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_aula_assistida_videoaula_id",
                table: "aula_assistida",
                column: "videoaula_id");

            migrationBuilder.CreateIndex(
                name: "ix_sessao_estudo_disciplina_id",
                table: "sessao_estudo",
                column: "disciplina_id");

            migrationBuilder.CreateIndex(
                name: "ix_sessao_estudo_tema_id",
                table: "sessao_estudo",
                column: "tema_id");

            migrationBuilder.CreateIndex(
                name: "ix_sessao_estudo_usuario_id_concluida_em",
                table: "sessao_estudo",
                columns: new[] { "usuario_id", "concluida_em" });

            migrationBuilder.CreateIndex(
                name: "ix_tentativa_questao_id",
                table: "tentativa",
                column: "questao_id");

            migrationBuilder.CreateIndex(
                name: "ix_tentativa_sessao_estudo_id_ordem",
                table: "tentativa",
                columns: new[] { "sessao_estudo_id", "ordem" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_tentativa_sessao_estudo_id_questao_id",
                table: "tentativa",
                columns: new[] { "sessao_estudo_id", "questao_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "aula_assistida");

            migrationBuilder.DropTable(
                name: "tentativa");

            migrationBuilder.DropTable(
                name: "sessao_estudo");
        }
    }
}
