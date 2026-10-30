using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kuitit.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Receipts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OwnerIssuer = table.Column<string>(type: "TEXT", maxLength: 500, nullable: false),
                    OwnerSub = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    OwnerEmail = table.Column<string>(type: "TEXT", maxLength: 320, nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    PurchasedOn = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    WarrantyMonths = table.Column<int>(type: "INTEGER", nullable: false),
                    ExpiresOn = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    FileName = table.Column<string>(type: "TEXT", maxLength: 255, nullable: false),
                    ContentType = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    StorageKey = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    SizeBytes = table.Column<long>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    ArchivedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Receipts", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Receipts_OwnerIssuer_OwnerSub",
                table: "Receipts",
                columns: new[] { "OwnerIssuer", "OwnerSub" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Receipts");
        }
    }
}
