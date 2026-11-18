using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Estudae.Infra.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RevisaoConteudoQuestao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "revisao_conteudo",
                table: "questao",
                type: "uuid",
                nullable: false,
                defaultValueSql: "gen_random_uuid()");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "revisao_conteudo",
                table: "questao");
        }
    }
}
