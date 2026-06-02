using System.IO;
using System.Windows;

namespace MDReports.Wpf;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        var filePath = e.Args.FirstOrDefault(IsMarkdownFile);
        var smokePdfPath = GetOptionValue(e.Args, "--smoke-pdf");
        new MainWindow(filePath, smokePdfPath).Show();
    }

    private static bool IsMarkdownFile(string value)
    {
        var extension = Path.GetExtension(value);
        return File.Exists(value) &&
               (extension.Equals(".md", StringComparison.OrdinalIgnoreCase) ||
                extension.Equals(".markdown", StringComparison.OrdinalIgnoreCase) ||
                extension.Equals(".txt", StringComparison.OrdinalIgnoreCase));
    }

    private static string? GetOptionValue(string[] args, string option)
    {
        var index = Array.FindIndex(args, value => value.Equals(option, StringComparison.OrdinalIgnoreCase));
        return index >= 0 && index + 1 < args.Length ? args[index + 1] : null;
    }
}
