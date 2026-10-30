using Kuitit.Api.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Kuitit.Api.Data;

/// <summary>Used by dotnet-ef only, so migrations don't need the full app configuration.</summary>
internal sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=design.db").Options, new NoUser());

    private sealed class NoUser : ICurrentUser
    {
        public UserIdentity? Identity => null;
    }
}
