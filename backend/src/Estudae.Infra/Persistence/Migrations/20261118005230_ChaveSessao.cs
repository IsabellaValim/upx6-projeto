using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Estudae.Infra.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ChaveSessao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "chave",
                table: "sessao_estudo",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "ix_sessao_estudo_usuario_id_chave",
                table: "sessao_estudo",
                columns: new[] { "usuario_id", "chave" },
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_sessao_estudo_chave",
                table: "sessao_estudo",
                sql: "chave ~ '^[A-Za-z0-9_.:-]{1,64}$'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_sessao_estudo_usuario_id_chave",
                table: "sessao_estudo");

            migrationBuilder.DropCheckConstraint(
                name: "ck_sessao_estudo_chave",
                table: "sessao_estudo");

            migrationBuilder.DropColumn(
                name: "chave",
                table: "sessao_estudo");
        }
    }
}
