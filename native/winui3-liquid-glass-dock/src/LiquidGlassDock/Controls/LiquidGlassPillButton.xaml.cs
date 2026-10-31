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
/// 独立的液态玻璃胶囊按钮：用 HLSL 像素着色器（LiquidGlassPill.cso）在自身背景上
/// 渲染「折射 + 边缘色散 + 流动镜面高光」。支持悬停透镜光斑跟随、按压体积形变
/// （弹簧缩放 + 折射/高光增强）与松手回弹。
/// </summary>
public sealed partial class LiquidGlassPillButton : UserControl
{
    /// <summary>白板离屏快照（玻璃采样来源，DIP 坐标，与窗口同尺寸）。</summary>
    public CanvasRenderTarget? Backdrop { get; set; }

    /// <summary>快照坐标参照根。</summary>
    public UIElement? BackdropRoot { get; set; }

    public LiquidGlassParameters Parameters { get; } = new();

    private bool _isSelected;
    public bool IsSelected
    {
        get => _isSelected;
        set { _isSelected = value; UpdateInk(); }
    }

    public string Glyph { get => Icon.Glyph; set => Icon.Glyph = value; }
    public string Text { get => Label.Text; set => Label.Text = value; }

    // 指针（按钮本地 UV，用于高光跟随）
    private double _pointerX = -1, _pointerY = -1;
    private bool _pressed;

    // 按压形变弹簧（Scale）
    private readonly GlassSpring _scaleSpring = new(1f, 1f);
    private readonly DispatcherQueueTimer _timer;
    private readonly Stopwatch _clock = Stopwatch.StartNew();
    private double _lastDt;

    private CanvasRenderTarget? _crop;

    public LiquidGlassPillButton()
    {
        InitializeComponent();
        GlassSurface.Draw += OnGlassDraw;
        _timer = DispatcherQueue.GetForCurrentThread().CreateTimer();
        _timer.Interval = TimeSpan.FromMilliseconds(16);
        _timer.IsRepeating = true;
        _timer.Tick += (_, _) => OnTick();
    }

    private void UpdateInk()
    {
        var c = _isSelected
            ? Color.FromArgb(255, 255, 255, 255)                       // 选中：通透亮白
            : Color.FromArgb(235, 235, 238, 242);                       // 未选中：浅灰
        Icon.Foreground = new SolidColorBrush(c);
        Label.Foreground = new SolidColorBrush(c);
    }

    private void OnGlassDraw(CanvasControl sender, CanvasDrawEventArgs args)
    {
        if (Backdrop == null) return;
        var ds = args.DrawingSession;
        ds.Clear(Color.FromArgb(0, 0, 0, 0));

        var w = (float)ActualWidth, h = (float)ActualHeight;
        if (w < 2 || h < 2) return;

        var dest = new Rect(0, 0, w, h);
        var sourceRect = GetSourceRect();

        // 裁剪白板快照到本按钮区域（含折射外扩余量）
        float margin = 24f;
        var cropRect = new Rect(sourceRect.X - margin, sourceRect.Y - margin, sourceRect.Width + margin * 2, sourceRect.Height + margin * 2);
        var crop = EnsureCrop(Backdrop, cropRect);

        var p = Parameters.Clone();
        float press = _pressed ? 1.35f : 1f;   // 按压时折射/高光增强
        var pointerUV = new Vector2((float)(_pointerX / w), (float)(_pointerY / h));

        var effect = LiquidGlassShaderEffect.Create(
            background: crop,
            refractionStrength: p.RefractionStrength * press,
            dispersion: p.DispersionPx * press,
            pointerUV: pointerUV,
            glareAngleRadians: p.GlareAngle * MathF.PI / 180f,
            glareRange: p.GlareRange,
            glareStrength: p.GlareFactor * press,
            pillHalf: new Vector2(0.48f, 0.48f),
            pillRadius: p.PillRadius,
            edgeSoftness: p.EdgeSoftness);

        // 极淡的透白底（“极度通透”），压在折射背景上仅作轻微提亮
        float baseAlpha = p.GlassBaseOpacity * (_isSelected ? 1.6f : 1f);
        ds.DrawImage(effect, dest, new Rect(margin, margin, w, h), 1f, CanvasImageInterpolation.HighQualityCubic);
        if (baseAlpha > 0.004f)
        {
            ds.FillRoundedRectangle(dest, h * p.PillRadius, h * p.PillRadius,
                Color.FromArgb((byte)Math.Clamp(baseAlpha * 255f, 0, 255), 255, 255, 255));
        }
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
        using var ds = _crop.CreateDrawingSession();
        ds.Clear(Color.FromArgb(0, 0, 0, 0));
        ds.DrawImage(backdrop, new Rect(0, 0, cropRect.Width, cropRect.Height), cropRect, 1f, CanvasImageInterpolation.Linear);
        return _crop;
    }

    private Rect GetSourceRect()
    {
        double w = ActualWidth, h = ActualHeight;
        if (BackdropRoot == null) return new Rect(0, 0, w, h);
        var t = GlassSurface.TransformToVisual(BackdropRoot);
        var pt = t.TransformPoint(new Point(0, 0));
        return new Rect(pt.X, pt.Y, w, h);
    }

    // ---------------- 交互 ----------------

    private void OnPointerEntered(object sender, PointerRoutedEventArgs e)
    {
        EnsureTimer();
    }

    private void OnPointerMoved(object sender, PointerRoutedEventArgs e)
    {
        var pt = e.GetCurrentPoint(Root);
        _pointerX = pt.Position.X;
        _pointerY = pt.Position.Y;
        GlassSurface.Invalidate();
    }

    private void OnPointerExited(object sender, PointerRoutedEventArgs e)
    {
        _pointerX = -1;
        _pointerY = -1;
        GlassSurface.Invalidate();
    }

    private void OnPointerPressed(object sender, PointerRoutedEventArgs e)
    {
        _pressed = true;
        _scaleSpring.Target = 0.94f;   // 水滴被按下：轻微体积收缩
        EnsureTimer();
        GlassSurface.Invalidate();
    }

    private void OnPointerReleased(object sender, PointerRoutedEventArgs e)
    {
        _pressed = false;
        _scaleSpring.Target = 1f;      // 松手 Q 弹回弹
        EnsureTimer();
        GlassSurface.Invalidate();
    }

    private void EnsureTimer() { if (!_timer.IsRunning) _timer.Start(); }

    private void OnTick()
    {
        double now = _clock.Elapsed.TotalSeconds;
        double dt = Math.Clamp(now - _lastDt, 0.0, 0.05);
        _lastDt = now;

        float scale = _scaleSpring.Step((float)dt, 700f, 24f);
        PressScale.ScaleX = scale;
        PressScale.ScaleY = scale;

        if (_pressed || !_scaleSpring.IsSettled(0.001f))
            GlassSurface.Invalidate();

        if (_scaleSpring.IsSettled(0.001f) && !_pressed)
            _timer.Stop();
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
