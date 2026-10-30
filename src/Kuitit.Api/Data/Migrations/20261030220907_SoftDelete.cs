using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kuitit.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class SoftDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "DeletedAt",
                table: "Receipts",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "DeletedAt",
                table: "ReceiptFiles",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Receipts_DeletedAt",
                table: "Receipts",
                column: "DeletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ReceiptFiles_DeletedAt",
                table: "ReceiptFiles",
                column: "DeletedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Receipts_DeletedAt",
                table: "Receipts");

            migrationBuilder.DropIndex(
                name: "IX_ReceiptFiles_DeletedAt",
                table: "ReceiptFiles");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Receipts");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "ReceiptFiles");
        }
    }
}
