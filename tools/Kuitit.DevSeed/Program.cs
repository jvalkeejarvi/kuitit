using Kuitit.Api.Auth;
using Kuitit.Api.Data;
using Kuitit.Api.Files;
using Kuitit.DevSeed;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

// Local sample data for the Aspire AppHost. Sign in to the mock IdP as `dev` to see it.
var builder = Host.CreateApplicationBuilder(args);

// Issuer of the `dev` user's tokens; receipts are only visible to the matching issuer + subject.
var issuer = builder.Configuration["SEED_ISSUER"] ?? throw new InvalidOperationException("SEED_ISSUER is not set.");
var user = new UserIdentity(issuer, SampleReceipts.Subject, "dev@example.com", "Dev");

builder.Services.AddSingleton<ICurrentUser>(new SeedUser(user));

// MigrationService needs it to resolve, though the host is never started.
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddAppDatabase(builder.Configuration);
builder.Services.AddSingleton<IFileStore>(sp => new LocalFileStore(
    Path.Combine(DataDir.Get(sp.GetRequiredService<IConfiguration>()), "files")
));

using var host = builder.Build();
await using var scope = host.Services.CreateAsyncScope();
var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
var files = scope.ServiceProvider.GetRequiredService<IFileStore>();

if (await db.Receipts.AnyAsync())
{
    Console.WriteLine($"'{user.Subject}' already has receipts; nothing to seed.");
    return;
}

var seeded = await SampleReceipts.SeedAsync(db, files, user, TimeProvider.System, CancellationToken.None);
Console.WriteLine($"Seeded {seeded} receipts for '{user.Subject}'.");

internal sealed class SeedUser(UserIdentity identity) : ICurrentUser
{
    public UserIdentity? Identity => identity;
}
