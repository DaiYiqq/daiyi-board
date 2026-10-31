using System.Numerics;
using Microsoft.Graphics.Canvas;
using Windows.Foundation;
using Windows.UI;

namespace LiquidGlassDock.Whiteboard;

/// <summary>
/// 白板“内容模型 + 纯绘制”：墨迹笔画、便签、形状。
/// 它不依赖任何 XAML 控件，既能画到屏幕（WhiteboardView），也能画到离屏快照
/// （供玻璃工具栏采样），从而保证“玻璃背后的背景”就是真实的白板内容。
/// </summary>
public sealed class WhiteboardScene
{
    public sealed class Stroke
    {
        public required List<Vector2> Points { get; init; }
        public required Color Color { get; init; }
        public required float Width { get; init; }
    }

    public sealed class Note
    {
        public required Rect Rect { get; init; }
        public required Color Color { get; init; }
    }

    public sealed class Shape
    {
        public required Rect Rect { get; init; }
        public required Color Color { get; init; }
        public required bool IsEllipse { get; init; }
    }

    private readonly List<Stroke> _strokes = new();
    private readonly List<Note> _notes = new();
    private readonly List<Shape> _shapes = new();

    public IReadOnlyList<Stroke> Strokes => _strokes;
    public IReadOnlyList<Note> Notes => _notes;
    public IReadOnlyList<Shape> Shapes => _shapes;

    /// <summary>世界坐标尺寸（逻辑像素，100% 缩放时）。内容在此范围内分布。</summary>
    public float WorldWidth { get; set; } = 3600f;
    public float WorldHeight { get; set; } = 2400f;

    private const float GridStep = 72f;

    public void AddStroke(Color color, float width, IEnumerable<Vector2> points)
    {
        var list = points.ToList();
        if (list.Count > 0)
            _strokes.Add(new Stroke { Points = list, Color = color, Width = width });
    }

    public void AddNote(Rect rect, Color color) => _notes.Add(new Note { Rect = rect, Color = color });

    public void AddShape(Rect rect, Color color, bool ellipse) =>
        _shapes.Add(new Shape { Rect = rect, Color = color, IsEllipse = ellipse });

    /// <summary>填充一批演示内容（彩色笔迹/便签/形状），便于直观看到折射与去饱和。</summary>
    public void SeedDemoContent()
    {
        // 彩色墨迹（不同颜色、宽度）
        AddStroke(Color.FromArgb(255, 40, 120, 208), 6f, SinePath(new Vector2(120, 320), 900f, 40f, 16));
        AddStroke(Color.FromArgb(255, 229, 72, 77), 8f, SinePath(new Vector2(160, 620), 1100f, 70f, 10));
        AddStroke(Color.FromArgb(255, 21, 128, 61), 5f, SinePath(new Vector2(120, 900), 1200f, 30f, 22));
        AddStroke(Color.FromArgb(255, 139, 92, 246), 7f, SinePath(new Vector2(200, 1180), 980f, 52f, 14));
        AddStroke(Color.FromArgb(255, 241, 166, 26), 6f, SinePath(new Vector2(140, 1450), 1150f, 36f, 18));

        // 彩色便签
        AddNote(new Rect(420, 220, 240, 180), Color.FromArgb(235, 255, 214, 128));
        AddNote(new Rect(760, 420, 260, 200), Color.FromArgb(235, 129, 212, 250));
        AddNote(new Rect(520, 760, 250, 190), Color.FromArgb(235, 255, 138, 160));
        AddNote(new Rect(860, 1050, 240, 180), Color.FromArgb(235, 174, 213, 129));
        AddNote(new Rect(460, 1280, 260, 200), Color.FromArgb(235, 149, 117, 205));

        // 形状（圆形 / 矩形）
        AddShape(new Rect(760, 220, 220, 220), Color.FromArgb(200, 3, 169, 244), true);
        AddShape(new Rect(1300, 420, 300, 200), Color.FromArgb(200, 255, 87, 34), false);
        AddShape(new Rect(1200, 900, 240, 240), Color.FromArgb(200, 0, 150, 136), true);
        AddShape(new Rect(1350, 1300, 320, 180), Color.FromArgb(200, 233, 30, 99), false);
    }

    private static IEnumerable<Vector2> SinePath(Vector2 start, float length, float amplitude, int segments)
    {
        for (int i = 0; i <= segments; i++)
        {
            float t = (float)i / segments;
            yield return new Vector2(
                start.X + t * length,
                start.Y + MathF.Sin(t * MathF.Tau * 2f) * amplitude);
        }
    }

    /// <summary>
    /// 以给定视图矩阵绘制整块白板（网格 + 内容）。
    /// 调用方负责先 Clear 画布背景。ds 处于设备无关像素（DIP）空间。
    /// </summary>
    public void Render(CanvasDrawingSession ds, Vector2 viewSize, Matrix3x2 view)
    {
        ds.Transform = view;

        // 网格：覆盖整块世界 + 一圈余量，随内容一起平移缩放。
        float margin = GridStep * 4;
        ds.DrawLine(new Vector2(-margin, 0), new Vector2(WorldWidth + margin, 0), Color.FromArgb(38, 128, 140, 155), 1.5f);
        ds.DrawLine(new Vector2(0, -margin), new Vector2(0, WorldHeight + margin), Color.FromArgb(38, 128, 140, 155), 1.5f);
        for (float x = 0; x <= WorldWidth + margin; x += GridStep)
            ds.DrawLine(new Vector2(x, -margin), new Vector2(x, WorldHeight + margin), Color.FromArgb(24, 128, 140, 155), 1f);
        for (float y = 0; y <= WorldHeight + margin; y += GridStep)
            ds.DrawLine(new Vector2(-margin, y), new Vector2(WorldWidth + margin, y), Color.FromArgb(24, 128, 140, 155), 1f);

        // 墨迹
        foreach (var s in _strokes)
        {
            if (s.Points.Count == 1)
            {
                ds.FillCircle(s.Points[0], s.Width / 2f, s.Color);
                continue;
            }
            using var builder = new CanvasPathBuilder(ds);
            builder.BeginFigure(s.Points[0]);
            foreach (var p in s.Points.Skip(1))
                builder.AddLine(p);
            builder.EndFigure(CanvasFigureLoop.Open);
            using var path = CanvasGeometry.CreatePath(builder);
            ds.DrawGeometry(path, s.Color, s.Width);
        }

        // 便签（圆角卡片 + 顶部浅色高光，模拟便签质感）
        foreach (var n in _notes)
        {
            ds.FillRoundedRectangle(n.Rect, 12f, 12f, n.Color);
            ds.DrawRoundedRectangle(n.Rect, 12f, 12f, Color.FromArgb(60, 255, 255, 255), 1.5f);
        }

        // 形状
        foreach (var s in _shapes)
        {
            if (s.IsEllipse)
                ds.FillEllipse(s.Rect, s.Color);
            else
                ds.FillRectangle(s.Rect, s.Color);
            ds.DrawRectangle(s.Rect, Color.FromArgb(70, 255, 255, 255), 2f);
        }
    }
}
