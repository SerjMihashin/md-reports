using Markdig;
using Microsoft.Win32;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Encodings.Web;
using System.Windows;
using System.Windows.Input;

namespace MDReports.Wpf;

public partial class MainWindow : Window
{
    private readonly MarkdownPipeline _pipeline = new MarkdownPipelineBuilder().UseAdvancedExtensions().DisableHtml().Build();
    private readonly string? _initialFile;
    private readonly string? _smokePdfPath;
    private string? _currentPath;
    private bool _dirty;
    private bool _darkMode;
    private bool _previewReady;
    private bool _suppressTextChange;

    public MainWindow(string? initialFile = null, string? smokePdfPath = null)
    {
        _initialFile = initialFile;
        _smokePdfPath = smokePdfPath;
        InitializeComponent();
    }

    private async void Window_Loaded(object sender, RoutedEventArgs e)
    {
        LoadRecentFiles();
        try
        {
            await PreviewWebView.EnsureCoreWebView2Async();
            _previewReady = true;
        }
        catch
        {
            MessageBox.Show("Для красивого предпросмотра нужен Microsoft Edge WebView2 Runtime. Установите его с сайта Microsoft и перезапустите приложение.",
                "Не найден WebView2 Runtime", MessageBoxButton.OK, MessageBoxImage.Warning);
        }

        if (!string.IsNullOrWhiteSpace(_initialFile)) OpenFile(_initialFile);
        else NewDocument();

        if (!string.IsNullOrWhiteSpace(_smokePdfPath)) await RunSmokePdfExport(_smokePdfPath);
    }

    private void Open_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new OpenFileDialog
        {
            Title = "Открыть Markdown-отчёт",
            Filter = "Markdown и текст (*.md;*.markdown;*.txt)|*.md;*.markdown;*.txt|Все файлы (*.*)|*.*"
        };
        if (dialog.ShowDialog() == true) OpenFile(dialog.FileName);
    }

    private void New_Click(object sender, RoutedEventArgs e) => NewDocument();
    private void Save_Click(object sender, RoutedEventArgs e) => SaveDocument(false);

    private async void ExportPdf_Click(object sender, RoutedEventArgs e)
    {
        if (!_previewReady || PreviewWebView.CoreWebView2 is null)
        {
            MessageBox.Show("Предпросмотр ещё не готов.", "Экспорт PDF", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        var dialog = new SaveFileDialog
        {
            Title = "Экспортировать отчёт в PDF",
            FileName = Path.GetFileNameWithoutExtension(_currentPath ?? "report") + ".pdf",
            Filter = "PDF (*.pdf)|*.pdf"
        };
        if (dialog.ShowDialog() != true) return;
        var ok = await PreviewWebView.CoreWebView2.PrintToPdfAsync(dialog.FileName);
        MessageBox.Show(ok ? "PDF сохранён." : "Не удалось сохранить PDF.", "Экспорт PDF", MessageBoxButton.OK,
            ok ? MessageBoxImage.Information : MessageBoxImage.Error);
    }

    private async Task RunSmokePdfExport(string outputPath)
    {
        if (!_previewReady || PreviewWebView.CoreWebView2 is null)
        {
            Application.Current.Shutdown(2);
            return;
        }

        await Task.Delay(1000);
        var ok = await PreviewWebView.CoreWebView2.PrintToPdfAsync(outputPath);
        Application.Current.Shutdown(ok ? 0 : 3);
    }

    private void Print_Click(object sender, RoutedEventArgs e)
    {
        if (_previewReady && PreviewWebView.CoreWebView2 is not null) PreviewWebView.CoreWebView2.ShowPrintUI();
    }

    private void Associate_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            const string appId = "MDReportsCompact.Markdown";
            var exePath = Environment.ProcessPath ?? Process.GetCurrentProcess().MainModule?.FileName ?? "";
            using var classes = Registry.CurrentUser.CreateSubKey(@"Software\Classes");
            classes.CreateSubKey(".md")?.SetValue("", appId);
            classes.CreateSubKey(".markdown")?.SetValue("", appId);
            classes.CreateSubKey(appId)?.SetValue("", "Markdown-документ");
            classes.CreateSubKey($@"{appId}\DefaultIcon")?.SetValue("", $"\"{exePath}\",0");
            classes.CreateSubKey($@"{appId}\shell\open\command")?.SetValue("", $"\"{exePath}\" \"%1\"");
            SHChangeNotify(0x08000000, 0, IntPtr.Zero, IntPtr.Zero);
            MessageBox.Show("Файлы .md связаны с приложением для текущего пользователя Windows.", "Готово",
                MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Не удалось связать .md: {ex.Message}", "Ошибка", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void Theme_Click(object sender, RoutedEventArgs e)
    {
        _darkMode = !_darkMode;
        DocumentGrid.Background = Brush(_darkMode ? "#18242A" : "#EEF2F5");
        RenderPreview();
    }

    private void PreviewMode_Click(object sender, RoutedEventArgs e) => SetMode("preview");
    private void SplitMode_Click(object sender, RoutedEventArgs e) => SetMode("split");
    private void EditorMode_Click(object sender, RoutedEventArgs e) => SetMode("editor");

    private void SetMode(string mode)
    {
        EditorColumn.Width = mode is "split" or "editor" ? new GridLength(1, GridUnitType.Star) : new GridLength(0);
        PreviewColumn.Width = mode == "editor" ? new GridLength(0) : new GridLength(1, GridUnitType.Star);
        PreviewHost.Visibility = mode == "editor" ? Visibility.Collapsed : Visibility.Visible;
        EditorTextBox.Visibility = mode == "preview" ? Visibility.Collapsed : Visibility.Visible;
    }

    private void NewDocument()
    {
        if (!CanDiscardChanges()) return;
        _currentPath = null;
        SetEditorText("# Новый отчёт\n\n");
        UpdateDocumentLabels();
        SetDirty(false);
        RenderPreview();
    }

    private void OpenFile(string filePath)
    {
        if (!CanDiscardChanges() || !File.Exists(filePath)) return;
        if (!new[] { ".md", ".markdown", ".txt" }.Contains(Path.GetExtension(filePath), StringComparer.OrdinalIgnoreCase))
        {
            MessageBox.Show("Можно открывать только Markdown или текстовые файлы.", "Файл не поддерживается",
                MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        _currentPath = filePath;
        SetEditorText(File.ReadAllText(filePath));
        AddRecentFile(filePath);
        UpdateDocumentLabels();
        SetDirty(false);
        RenderPreview();
    }

    private bool SaveDocument(bool saveAs)
    {
        var path = _currentPath;
        if (saveAs || string.IsNullOrWhiteSpace(path))
        {
            var dialog = new SaveFileDialog
            {
                Title = "Сохранить Markdown-отчёт",
                FileName = Path.GetFileName(path ?? "report.md"),
                Filter = "Markdown (*.md)|*.md|Текст (*.txt)|*.txt"
            };
            if (dialog.ShowDialog() != true) return false;
            path = dialog.FileName;
        }
        File.WriteAllText(path, EditorTextBox.Text);
        _currentPath = path;
        AddRecentFile(path);
        UpdateDocumentLabels();
        SetDirty(false);
        return true;
    }

    private void RenderPreview()
    {
        if (!_previewReady) return;
        var body = Markdown.ToHtml(EditorTextBox.Text ?? "", _pipeline);
        var title = HtmlEncoder.Default.Encode(Path.GetFileName(_currentPath ?? "Новый отчёт"));
        var palette = _darkMode
            ? "body{background:#18242a;color:#e8f0f2}.page{background:#223138;border-color:#3b4f56}h1,h2,h3{color:#e7f6f7}th{background:#28474e;color:#d7f4f5}td{border-color:#3b4f56}code{background:#30434a;color:#ffbe88}"
            : "body{background:#eef2f5;color:#1e2933}.page{background:#fff;border-color:#dce3e8}h1,h2,h3{color:#17363e}th{background:#e6f5f6;color:#17434a}td{border-color:#dce3e8}code{background:#eef3f5;color:#9a3e17}";
        var html = """
            <!doctype html><html lang="ru"><head><meta charset="utf-8"><title>__TITLE__</title>
            <style>*{box-sizing:border-box}__PALETTE__
            body{margin:0;padding:28px;font:15px/1.7 "Segoe UI",Arial,sans-serif}
            .page{max-width:980px;min-height:100vh;margin:0 auto;padding:52px 64px;border:1px solid;border-radius:6px;box-shadow:0 12px 32px rgba(31,54,68,.08)}
            h1{margin:0 0 10px;font-size:32px;line-height:1.25}h2{margin-top:38px;padding-bottom:9px;border-bottom:2px solid #e6f5f6;font-size:23px;line-height:1.25}h3{margin-top:26px;font-size:18px;line-height:1.25}
            table{width:100%;margin:18px 0;border-collapse:collapse;font-size:13px}th,td{padding:9px 11px;border:1px solid;text-align:left;vertical-align:top}
            pre{overflow:auto;padding:15px;border-radius:5px;background:#1f2933;color:#e6edf2}code{padding:2px 4px;border-radius:3px;font-family:Consolas,monospace}pre code{padding:0;background:transparent;color:inherit}
            hr{margin:30px 0;border:0;border-top:1px solid #dce3e8}blockquote{margin-left:0;padding:3px 14px;border-left:4px solid #087f8c;color:#6d7a86}
            @media print{body{padding:0;background:#fff!important}.page{max-width:none;min-height:0;padding:0;border:0;box-shadow:none;background:#fff!important;color:#111!important}}
            </style></head><body><article class="page">__BODY__</article></body></html>
            """
            .Replace("__TITLE__", title)
            .Replace("__PALETTE__", palette)
            .Replace("__BODY__", body);
        PreviewWebView.NavigateToString(html);
    }

    private void EditorTextBox_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
    {
        if (_suppressTextChange) return;
        SetDirty(true);
        RenderPreview();
    }

    private void SetEditorText(string text)
    {
        _suppressTextChange = true;
        EditorTextBox.Text = text;
        _suppressTextChange = false;
    }

    private void SetDirty(bool value)
    {
        _dirty = value;
        SaveStateText.Text = value ? "Есть изменения" : "Сохранено";
        SaveStateText.Foreground = Brush(value ? "#A55D08" : "#6D7A86");
    }

    private void UpdateDocumentLabels()
    {
        FileNameText.Text = Path.GetFileName(_currentPath ?? "Новый отчёт");
        FilePathText.Text = _currentPath ?? "Документ ещё не сохранён";
        Title = $"MD Отчёты Compact — {FileNameText.Text}";
    }

    private bool CanDiscardChanges() =>
        !_dirty || MessageBox.Show("В документе есть несохранённые изменения. Продолжить?", "MD Отчёты Compact",
            MessageBoxButton.YesNo, MessageBoxImage.Question) == MessageBoxResult.Yes;

    private string RecentFileStore => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "MD-Reports-Compact", "recent-files.txt");

    private void AddRecentFile(string filePath)
    {
        var files = ReadRecentFiles().Where(path => !path.Equals(filePath, StringComparison.OrdinalIgnoreCase)).Prepend(filePath).Take(8);
        Directory.CreateDirectory(Path.GetDirectoryName(RecentFileStore)!);
        File.WriteAllLines(RecentFileStore, files);
        LoadRecentFiles();
    }

    private IEnumerable<string> ReadRecentFiles() =>
        File.Exists(RecentFileStore) ? File.ReadAllLines(RecentFileStore).Where(File.Exists).Take(8) : [];

    private void LoadRecentFiles() =>
        RecentFilesList.ItemsSource = ReadRecentFiles().Select(path => new RecentFile(Path.GetFileName(path), path)).ToList();

    private void RecentFilesList_SelectionChanged(object sender, System.Windows.Controls.SelectionChangedEventArgs e)
    {
        if (RecentFilesList.SelectedItem is RecentFile file)
        {
            RecentFilesList.SelectedItem = null;
            OpenFile(file.FullPath);
        }
    }

    private void Window_DragEnter(object sender, DragEventArgs e) =>
        e.Effects = e.Data.GetDataPresent(DataFormats.FileDrop) ? DragDropEffects.Copy : DragDropEffects.None;

    private void Window_Drop(object sender, DragEventArgs e)
    {
        if (e.Data.GetData(DataFormats.FileDrop) is string[] files && files.Length > 0) OpenFile(files[0]);
    }

    private void Window_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if ((Keyboard.Modifiers & ModifierKeys.Control) == 0) return;
        if (e.Key == Key.S) { SaveDocument((Keyboard.Modifiers & ModifierKeys.Shift) != 0); e.Handled = true; }
        if (e.Key == Key.O) { Open_Click(sender, e); e.Handled = true; }
        if (e.Key == Key.N) { NewDocument(); e.Handled = true; }
    }

    private void Window_Closing(object? sender, CancelEventArgs e)
    {
        if (!CanDiscardChanges()) e.Cancel = true;
    }

    private static System.Windows.Media.Brush Brush(string value) =>
        (System.Windows.Media.Brush)new System.Windows.Media.BrushConverter().ConvertFromString(value)!;

    [DllImport("shell32.dll")]
    private static extern void SHChangeNotify(uint eventId, uint flags, IntPtr item1, IntPtr item2);

    private sealed record RecentFile(string Name, string FullPath);
}
