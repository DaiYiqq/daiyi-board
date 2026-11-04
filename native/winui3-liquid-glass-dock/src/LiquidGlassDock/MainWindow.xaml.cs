using System;
using LiquidGlassDock.Controls;
using Microsoft.UI.Xaml;
using Windows.Foundation;
using Windows.Graphics;
using Windows.UI;

namespace LiquidGlassDock;

public sealed partial class MainWindow : Window
{
    private static readonly Color[] DemoPalette =
    {
        Color.FromArgb(255, 255, 214, 128),
        Color.FromArgb(255, 129, 212, 250),
        Color.FromArgb(255, 255, 138, 160),
        Color.FromArgb(255, 174, 213, 129),
        Color.FromArgb(255, 149, 117, 205),
    };

    private readonly Random _random = new();

    public MainWindow()
    {
        InitializeComponent();
        Title = "DY Board — 液态玻璃底部工具栏 Demo";

        // 非打包运行下给一个合理的初始窗口尺寸。
        AppWindow.Resize(new SizeInt32(1280, 820));

        // 共享同一份参数：工具栏渲染 + 参数面板双向绑定。
        Settings.Bind(Dock.Parameters);

        // 白板内容/视图变化 → 玻璃重新采样背景（保证缩放/平移连续更新）。
        Board.BackdropChanged += () =>
        {
            Dock.Backdrop = Board.Snapshot;
            Dock.InvalidateBackdrop();
        };

        Dock.BackdropRoot = Root;
        Dock.IsWritingProvider = () => Board.IsInking;
        Dock.ToolSelected += OnToolSelected;
    }

    private void OnToolSelected(GlassDock.DockTool tool)
    {
        switch (tool)
        {
            case GlassDock.DockTool.Select:
                Board.ActiveTool = WhiteboardView.BoardTool.Pan;
                break;
            case GlassDock.DockTool.Pen:
                Board.ActiveTool = WhiteboardView.BoardTool.Pen;
                Board.SetInk(Color.FromArgb(255, 33, 33, 33), 5f);
                break;
            case GlassDock.DockTool.Eraser:
                Board.ActiveTool = WhiteboardView.BoardTool.Pen;
                Board.SetInk(Color.FromArgb(255, 245, 246, 248), 22f); // 用底色当橡皮
                break;
            case GlassDock.DockTool.Note:
                Board.Scene.AddNote(RandomRect(), RandomColor());
                Board.Refresh();
                break;
            case GlassDock.DockTool.Shape:
                Board.Scene.AddShape(RandomRect(), RandomColor(), _random.Next(2) == 0);
                Board.Refresh();
                break;
            case GlassDock.DockTool.Text:
                // 文字工具此处以一张便签占位演示；真实文字输入需要单独的文本控件（见文档）。
                Board.Scene.AddNote(RandomRect(), RandomColor());
                Board.Refresh();
                break;
        }
    }

    private Rect RandomRect()
    {
        float x = 600 + _random.Next(0, 1200);
        float y = 400 + _random.Next(0, 900);
        return new Rect(x, y, 220 + _random.Next(0, 120), 160 + _random.Next(0, 80));
    }

    private Color RandomColor() => DemoPalette[_random.Next(DemoPalette.Length)];

    private void OnToggleSettings(object sender, RoutedEventArgs e)
    {
        Settings.Visibility = Settings.Visibility == Visibility.Visible ? Visibility.Collapsed : Visibility.Visible;
    }
}
