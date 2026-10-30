namespace Kuitit.Api.Data;

internal static class DataDir
{
    /// <summary>Root for the SQLite DB, uploaded files and DataProtection keys (`DATA_DIR`).</summary>
    public static string Get(IConfiguration configuration)
    {
        var dir = configuration["DATA_DIR"];
        if (string.IsNullOrWhiteSpace(dir))
        {
            throw new InvalidOperationException("DATA_DIR is not configured.");
        }

        var full = Path.GetFullPath(dir);
        Directory.CreateDirectory(full);
        return full;
    }
}
