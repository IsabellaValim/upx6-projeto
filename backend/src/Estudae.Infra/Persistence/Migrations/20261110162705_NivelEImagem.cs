using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Estudae.Infra.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class NivelEImagem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "imagem_descricao",
                table: "questao",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "nivel",
                table: "disciplina",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "medio");

            migrationBuilder.AddCheckConstraint(
                name: "ck_disciplina_nivel",
                table: "disciplina",
                sql: "nivel IN ('fundamental', 'medio')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_disciplina_nivel",
                table: "disciplina");

            migrationBuilder.DropColumn(
                name: "imagem_descricao",
                table: "questao");

            migrationBuilder.DropColumn(
                name: "nivel",
                table: "disciplina");
        }
    }
}
