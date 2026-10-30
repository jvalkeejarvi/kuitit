using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kuitit.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ReceiptStoreAndDescription : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Receipts",
                type: "TEXT",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Store",
                table: "Receipts",
                type: "TEXT",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Description",
                table: "Receipts");

            migrationBuilder.DropColumn(
                name: "Store",
                table: "Receipts");
        }
    }
}
