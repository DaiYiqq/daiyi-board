using System.Diagnostics;
using System.Numerics;
using LiquidGlassDock.Glass;
using Microsoft.Graphics.Canvas;
using Microsoft.Graphics.Canvas.UI.Xaml;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Windows.Foundation;
using Windows.UI;

namespace LiquidGlassDock.Controls;

/// <summary>
/// 底部透明液态玻璃胶囊工具栏。玻璃背景可走两条管线：
///   · UseShader=true  → HLSL 像素着色器（折射 + 色散 + 流动高光，首选）
///   · UseShader=false → LiquidGlassEffectRenderer 内置效果（兜底）
/// 每个工具按钮都是独立的 <see cref="LiquidGlassPillButton"/> 胶囊。
/// </summary>
public sealed partial class GlassDock : UserControl
{
    public enum DockTool { Select, Pen, Eraser, Note, Shape, Text }

    public LiquidGlassParameters Parameters { get; } = new();
    public LiquidGlassEffectRenderer Renderer { get; } = new();

    /// <summary>白板离屏快照（由 MainWindow 注入，DIP 坐标，与窗口同尺寸）。</summary>
    public CanvasRenderTarget? Backdrop { get; set; }

    /// <summary>快照坐标参照根（通常是主窗口根 Grid 或白板控件）。</summary>
    public UIElement? BackdropRoot { get; set; }

    /// <summary>读取白板“是否正在书写”，用于书写态退后。</summary>
    public Func<bool>? IsWritingProvider { get; set; }

    /// <summary>用户点选工具时触发（MainWindow 负责落到白板行为）。</summary>
    public event Action<DockTool>? ToolSelected;

    private DockTool _selectedTool = DockTool.Pen;
    private readonly List<LiquidGlassPillButton> _pillButtons = new();

    // 交互状态
    private bool _dragging;
    private double _dragLastX;
    private double _lastMoveAt;
    private float _slideOffset;
    private float _slideVelocity;
    private readonly GlassSpring _slideSpring = new(0f, 0f);

    private double _pointerX = -1, _pointerY = -1;
    private readonly GlassSpring _glareSpring = new(0f, 0f);

    private float _timeSec;
    private Color _tintColor = Color.FromArgb(255, 245, 246, 248);

    private readonly DispatcherQueueTimer _timer;
    private readonly Stopwatch _clock = Stopwatch.StartNew();
    private double _lastDt;

    private CanvasRenderTarget? _crop;   // 着色器路径的裁剪缓冲

    public GlassDock()
    {
        InitializeComponent();
        GlassSurface.Draw += OnGlassDraw;
        WirePillButtons();

        _timer = DispatcherQueue.GetForCurrentThread().CreateTimer();
        _timer.Interval = TimeSpan.FromMilliseconds(16);
        _timer.IsRepeating = true;
        _timer.Tick += (_, _) => OnTick();
    }

    private void WirePillButtons()
    {
        foreach (var child in ButtonRow.Children)
        {
            if (child is LiquidGlassPillButton pill)
            {
                pill.Parameters = Parameters;   // 共享同一份参数
                pill.Click += OnPillClick;
                _pillButtons.Add(pill);
            }
        }
        UpdateSelection();
    }

    private void SyncPillBackdrops()
    {
        foreach (var pill in _pillButtons)
        {
            pill.Backdrop = Backdrop;
            pill.BackdropRoot = BackdropRoot;
        }
    }

    /// <summary>背景（白板）变化后由 MainWindow 调用：重新采样染色并重绘。</summary>
    public void InvalidateBackdrop()
    {
        if (Backdrop != null)
        {
            var avg = Renderer.SampleAverageColor(Backdrop, GetSourceRect());
            _tintColor = LiquidGlassEffectRenderer.Desaturate(avg, Parameters.Desaturation);
        }
        SyncPillBackdrops();
        GlassSurface.Invalidate();
    }

    private Rect GetSourceRect()
    {
        double w = ActualWidth, h = ActualHeight;
        if (BackdropRoot == null) return new Rect(0, 0, w, h);
        var t = GlassSurface.TransformToVisual(BackdropRoot);
        var p = t.TransformPoint(new Point(0, 0));
        return new Rect(p.X, p.Y, w, h);
    }

    private void OnGlassDraw(CanvasControl sender, CanvasDrawEventArgs args)
    {
        if (Backdrop == null) return;
        var ds = args.DrawingSession;
        ds.Clear(Color.FromArgb(0, 0, 0, 0));

        var destRect = new Rect(0, 0, ActualWidth, ActualHeight);
        bool writing = IsWritingProvider?.Invoke() ?? false;

        // 参数快照，避免绘制途中参数被 UI 线程改动。
        var p = Parameters.Clone();
        var pointerLocal = new Vector2((float)_pointerX, (float)_pointerY);

        if (p.UseShader)
        {
            DrawShaderGlass(ds, p, pointerLocal);
        }
        else
        {
            Renderer.Draw(
                ds, Backdrop, GetSourceRect(), destRect,
                cornerRadius: (float)ActualHeight / 2f,   // 胶囊（Pill）：圆角 = 半高
                p, pointerLocal, _slideOffset, _slideVelocity, _timeSec, _tintColor, writing);
        }
    }

    private void DrawShaderGlass(CanvasDrawingSession ds, LiquidGlassParameters p, Vector2 pointerLocal)
    {
        float w = (float)ActualWidth, h = (float)ActualHeight;
        if (w < 2 || h < 2) return;
        var dest = new Rect(0, 0, w, h);
        var src = GetSourceRect();

        float margin = 28f;
        var cropRect = new Rect(src.X + _slideOffset - margin, src.Y - margin, src.Width + margin * 2, src.Height + margin * 2);
        var crop = EnsureCrop(Backdrop!, cropRect);

        var pointerUV = new Vector2((float)(_pointerX / w), (float)(_pointerY / h));

        var effect = LiquidGlassShaderEffect.Create(
            background: crop,
            refractionStrength: p.RefractionStrength,
            dispersion: p.DispersionPx,
            pointerUV: pointerUV,
            glareAngleRadians: p.GlareAngle * MathF.PI / 180f,
            glareRange: p.GlareRange,
            glareStrength: p.GlareFactor,
            pillHalf: new Vector2(0.48f, 0.48f),
            pillRadius: p.PillRadius,
            edgeSoftness: p.EdgeSoftness);

        ds.DrawImage(effect, dest, new Rect(margin, margin, w, h), 1f, CanvasImageInterpolation.HighQualityCubic);
    }

    private CanvasRenderTarget EnsureCrop(CanvasRenderTarget backdrop, Rect cropRect)
    {
        var bs = backdrop.Size;
        cropRect = Intersect(cropRect, new Rect(0, 0, bs.Width, bs.Height));
        if (cropRect.Width <= 0 || cropRect.Height <= 0) cropRect = new Rect(0, 0, 1, 1);

        if (_crop == null || MathF.Abs((float)_crop.Size.Width - (float)cropRect.Width) > 1f
            || MathF.Abs((float)_crop.Size.Height - (float)cropRect.Height) > 1f)
        {
            _crop?.Dispose();
            _crop = new CanvasRenderTarget(CanvasDevice.GetSharedDevice(), cropRect.Width, cropRect.Height, backdrop.Dpi);
        }
        using var cds = _crop.CreateDrawingSession();
        cds.Clear(Color.FromArgb(0, 0, 0, 0));
        cds.DrawImage(backdrop, new Rect(0, 0, cropRect.Width, cropRect.Height), cropRect, 1f, CanvasImageInterpolation.Linear);
        return _crop;
    }

    // ---------------------------------------------------------------- 交互

    private void OnSlidePressed(object sender, PointerRoutedEventArgs e)
    {
        // 不拦截按钮点击：按在胶囊按钮（或其子元素）上时，交给按钮处理，不启动滑动。
        if (e.OriginalSource is DependencyObject src && IsWithinButton(src)) return;

        var pt = e.GetCurrentPoint(LayoutRoot);
        _dragging = true;
        _dragLastX = pt.Position.X;
        _lastMoveAt = _clock.Elapsed.TotalSeconds;
        _slideSpring.Target = _slideOffset;
        LayoutRoot.CapturePointer(e.Pointer);
        EnsureTimerRunning();
    }

    private static bool IsWithinButton(DependencyObject? node)
    {
        while (node != null)
        {
            if (node is Button or LiquidGlassPillButton) return true;
            node = VisualTreeHelper.GetParent(node);
        }
        return false;
    }

    private void OnPointerMoved(object sender, PointerRoutedEventArgs e)
    {
        var pt = e.GetCurrentPoint(LayoutRoot);
        _pointerY = pt.Position.Y;
        _glareSpring.Target = (float)pt.Position.X;

        if (_dragging)
        {
            double dx = pt.Position.X - _dragLastX;
            double now = _clock.Elapsed.TotalSeconds;
            double moveDt = Math.Max(0.001, now - _lastMoveAt);
            _lastMoveAt = now;
            _dragLastX = pt.Position.X;
            float max = Parameters.MaxSlideOffset * 1.5f;
            _slideOffset = Math.Clamp(_slideOffset + (float)dx * 0.85f, -max, max);
            _slideVelocity = (float)(dx / moveDt);
        }
        EnsureTimerRunning();
    }

    private void OnSlideReleased(object sender, PointerRoutedEventArgs e)
    {
        if (!_dragging) return;
        _dragging = false;
        LayoutRoot.ReleasePointerCapture(e.Pointer);
        _slideSpring.SetImmediate(_slideOffset);
        _slideSpring.Target = 0f;
        EnsureTimerRunning();
    }

    private void OnPointerExited(object sender, PointerRoutedEventArgs e)
    {
        _pointerX = -1;
        _pointerY = -1;
        _glareSpring.Target = -1f;
        EnsureTimerRunning();
    }

    // ---------------------------------------------------------------- 动画循环

    private void EnsureTimerRunning() { if (!_timer.IsRunning) _timer.Start(); }

    private void OnTick()
    {
        double now = _clock.Elapsed.TotalSeconds;
        double dt = Math.Clamp(now - _lastDt, 0.0, 0.05);
        _lastDt = now;
        float fdt = (float)dt;
        _timeSec += fdt;

        if (!_dragging)
        {
            _slideOffset = _slideSpring.Step(fdt, Parameters.SpringStiffness, Parameters.SpringDamping);
            _slideVelocity *= 0.90f;
        }

        _glareSpring.Step(fdt, 240f, 22f);
        if (_glareSpring.Target < 0)
            _pointerX = -1;
        else
            _pointerX = _glareSpring.Position;

        GlassSurface.Invalidate();

        if (!_dragging && _slideSpring.IsSettled(0.3f) && _glareSpring.IsSettled(1.5f))
        {
            _slideVelocity = 0f;
            _timer.Stop();
        }
    }

    // ---------------------------------------------------------------- 工具按钮

    private void OnPillClick(object? sender, EventArgs e)
    {
        if (sender is FrameworkElement { Tag: string tag } && Enum.TryParse<DockTool>(tag, out var tool))
        {
            _selectedTool = tool;
            UpdateSelection();
            ToolSelected?.Invoke(tool);
        }
    }

    private void UpdateSelection()
    {
        foreach (var pill in _pillButtons)
        {
            pill.IsSelected = (pill.Tag as string) == _selectedTool.ToString();
        }
    }

    private static Rect Intersect(Rect a, Rect b)
    {
        double x = Math.Max(a.X, b.X), y = Math.Max(a.Y, b.Y);
        double r = Math.Min(a.X + a.Width, b.X + b.Width);
        double bot = Math.Min(a.Y + a.Height, b.Y + b.Height);
        if (r <= x || bot <= y) return new Rect(0, 0, 0, 0);
        return new Rect(x, y, r - x, bot - y);
    }
}
