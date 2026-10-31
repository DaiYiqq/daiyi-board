using System.Diagnostics;
using System.Numerics;
using LiquidGlassDock.Glass;
using Microsoft.Graphics.Canvas;
using Microsoft.Graphics.Canvas.UI.Xaml;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Media;
using Windows.Foundation;
using Windows.UI;

namespace LiquidGlassDock.Controls;

/// <summary>
/// 底部透明液态玻璃按钮栏。玻璃背景由 <see cref="LiquidGlassEffectRenderer"/> 真实采样白板快照，
/// 支持：横向弹性滑动（回弹）、指针高光跟随、滑动方向折射拉伸、书写态退后。
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

    private static readonly Color DefaultInk = Color.FromArgb(255, 34, 38, 46);
    private static readonly Color SelectedInk = Color.FromArgb(255, 11, 117, 71);

    public GlassDock()
    {
        InitializeComponent();
        GlassSurface.Draw += OnGlassDraw;
        UpdateSelection();

        _timer = DispatcherQueue.GetForCurrentThread().CreateTimer();
        _timer.Interval = TimeSpan.FromMilliseconds(16);
        _timer.IsRepeating = true;
        _timer.Tick += (_, _) => OnTick();
    }

    /// <summary>背景（白板）变化后由 MainWindow 调用：重新采样染色并重绘。</summary>
    public void InvalidateBackdrop()
    {
        if (Backdrop != null)
        {
            var avg = Renderer.SampleAverageColor(Backdrop, GetSourceRect());
            _tintColor = LiquidGlassEffectRenderer.Desaturate(avg, Parameters.Desaturation);
        }
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

        Renderer.Draw(
            ds, Backdrop, GetSourceRect(), destRect,
            cornerRadius: 24f,
            p, pointerLocal, _slideOffset, _slideVelocity, _timeSec, _tintColor, writing);
    }

    // ---------------------------------------------------------------- 交互

    private void OnSlidePressed(object sender, PointerRoutedEventArgs e)
    {
        // 不拦截按钮点击：按在按钮（或其子元素）上时，交给按钮处理，不启动滑动。
        if (e.OriginalSource is DependencyObject src && IsWithinButton(src)) return;

        var pt = e.GetCurrentPoint(LayoutRoot);
        _dragging = true;
        _dragLastX = pt.Position.X;
        _lastMoveAt = _clock.Elapsed.TotalSeconds;
        _slideSpring.Target = _slideOffset; // 保持当前偏移，松手后回弹
        LayoutRoot.CapturePointer(e.Pointer);
        EnsureTimerRunning();
    }

    private static bool IsWithinButton(DependencyObject? node)
    {
        while (node != null)
        {
            if (node is Button) return true;
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
            _slideVelocity = (float)(dx / moveDt); // DIP/s，供边缘折射拉伸
        }
        EnsureTimerRunning(); // 高光跟随也需要计时器
    }

    private void OnSlideReleased(object sender, PointerRoutedEventArgs e)
    {
        if (!_dragging) return;
        _dragging = false;
        LayoutRoot.ReleasePointerCapture(e.Pointer);
        // 松手后弹簧回弹到 0：先复位位置/速度，再把目标设为 0。
        _slideSpring.SetImmediate(_slideOffset);
        _slideSpring.Target = 0f;
        EnsureTimerRunning();
    }

    private void OnPointerExited(object sender, PointerRoutedEventArgs e)
    {
        _pointerX = -1;
        _pointerY = -1;
        _glareSpring.Target = -1f;
        EnsureTimerRunning(); // 让弹簧回落并重绘，隐藏高光
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
            _slideVelocity *= 0.90f; // 衰减
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

    private void OnToolClick(object sender, RoutedEventArgs e)
    {
        if (sender is Button { Tag: string tag } && Enum.TryParse<DockTool>(tag, out var tool))
        {
            _selectedTool = tool;
            UpdateSelection();
            ToolSelected?.Invoke(tool);
        }
    }

    private void UpdateSelection()
    {
        foreach (var child in ButtonRow.Children)
        {
            if (child is Button { Tag: string tag } btn)
            {
                bool on = tag == _selectedTool.ToString();
                btn.Foreground = new SolidColorBrush(on ? SelectedInk : DefaultInk);
                btn.FontWeight = on ? Microsoft.UI.Text.FontWeights.SemiBold : Microsoft.UI.Text.FontWeights.Normal;
            }
        }
    }
}
