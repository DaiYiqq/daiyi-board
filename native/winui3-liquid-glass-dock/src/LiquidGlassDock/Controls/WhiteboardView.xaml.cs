using System.Numerics;
using LiquidGlassDock.Whiteboard;
using Microsoft.Graphics.Canvas;
using Microsoft.Graphics.Canvas.UI.Xaml;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Windows.UI;

namespace LiquidGlassDock.Controls;

/// <summary>
/// 白板画布控件：把 WhiteboardScene 画到屏幕，同时渲染到一张共享离屏快照
/// （<see cref="Snapshot"/>），供底部玻璃工具栏“真实采样”背景。
/// 支持平移（右键拖拽 / 平移工具）、缩放（滚轮）、书写（左键画笔）。
/// </summary>
public sealed partial class WhiteboardView : UserControl
{
    public WhiteboardScene Scene { get; }

    private float _zoom = 1f;
    private Vector2 _offset;

    private bool _panning;
    private Vector2 _panLast;

    private bool _inking;
    private List<Vector2>? _inkStroke;

    private Color _inkColor = Color.FromArgb(255, 33, 33, 33);
    private float _inkWidth = 5f;

    /// <summary>当前是否正在书写（用于玻璃工具栏“书写时退后”）。</summary>
    public bool IsInking => _inking;

    /// <summary>供玻璃工具栏采样的离屏快照（DIP 坐标，与窗口同尺寸）。</summary>
    public CanvasRenderTarget? Snapshot { get; private set; }

    /// <summary>内容或视图变化后触发，通知玻璃工具栏重新裁剪采样。</summary>
    public event Action? BackdropChanged;

    /// <summary>当前激活工具：Pen=书写，Pan=平移。</summary>
    public enum BoardTool { Pen, Pan }
    public BoardTool ActiveTool { get; set; } = BoardTool.Pen;

    public WhiteboardView()
    {
        InitializeComponent();
        Scene = new WhiteboardScene();
        Scene.SeedDemoContent();
        Canvas.Draw += OnDraw;
        Canvas.PointerPressed += OnPointerPressed;
        Canvas.PointerMoved += OnPointerMoved;
        Canvas.PointerReleased += OnPointerReleased;
        Canvas.PointerWheelChanged += OnWheel;
    }

    public void SetInk(Color color, float width) { _inkColor = color; _inkWidth = width; }
    public void ResetView() { _zoom = 1f; _offset = Vector2.Zero; InvalidateAll(); }

    /// <summary>内容（便签/形状等）变化后重绘并通知玻璃重新采样。</summary>
    public void Refresh() => InvalidateAll();

    private Vector2 ToWorld(Vector2 screen) => (screen - _offset) / _zoom;
    private Matrix3x2 ViewMatrix => Matrix3x2.CreateScale(_zoom) * Matrix3x2.CreateTranslation(_offset);

    private void OnDraw(CanvasControl sender, CanvasDrawEventArgs args)
    {
        var size = sender.Size; // DIP
        var dpi = sender.Dpi;

        // 1) 画到屏幕
        Render(args.DrawingSession, size);

        // 2) 同步到共享快照（玻璃背景源）。按 DIP 尺寸 + DPI 判断是否重建。
        if (Snapshot == null
            || MathF.Abs((float)Snapshot.Size.Width - size.X) > 0.5f
            || MathF.Abs((float)Snapshot.Size.Height - size.Y) > 0.5f
            || MathF.Abs(Snapshot.Dpi - dpi) > 0.5f)
        {
            Snapshot?.Dispose();
            Snapshot = new CanvasRenderTarget(CanvasDevice.GetSharedDevice(), size.X, size.Y, dpi);
        }

        using (var snapDs = Snapshot.CreateDrawingSession())
        {
            Render(snapDs, size);
        }

        BackdropChanged?.Invoke();
    }

    private void Render(CanvasDrawingSession ds, Vector2 size)
    {
        ds.Clear(Color.FromArgb(255, 245, 246, 248)); // 白板底色（浅色）
        Scene.Render(ds, size, ViewMatrix);
    }

    private void OnPointerPressed(object sender, PointerRoutedEventArgs e)
    {
        var pt = e.GetCurrentPoint(Canvas);
        var pos = new Vector2((float)pt.Position.X, (float)pt.Position.Y);

        bool panButton = pt.Properties.IsRightButtonPressed || pt.Properties.IsMiddleButtonPressed;
        if (panButton || ActiveTool == BoardTool.Pan)
        {
            _panning = true;
            _panLast = pos;
            Canvas.CapturePointer(e.Pointer);
            return;
        }

        _inking = true;
        _inkStroke = new List<Vector2> { ToWorld(pos) };
        Canvas.CapturePointer(e.Pointer);
        BackdropChanged?.Invoke();
    }

    private void OnPointerMoved(object sender, PointerRoutedEventArgs e)
    {
        var pt = e.GetCurrentPoint(Canvas);
        var pos = new Vector2((float)pt.Position.X, (float)pt.Position.Y);

        if (_panning)
        {
            _offset += pos - _panLast;
            _panLast = pos;
            Canvas.Invalidate();
            return;
        }

        if (_inking && _inkStroke != null)
        {
            _inkStroke.Add(ToWorld(pos));
            Canvas.Invalidate();
        }
    }

    private void OnPointerReleased(object sender, PointerRoutedEventArgs e)
    {
        if (_panning)
        {
            _panning = false;
            Canvas.ReleasePointerCapture(e.Pointer);
            return;
        }
        if (_inking && _inkStroke != null)
        {
            Scene.AddStroke(_inkColor, _inkWidth, _inkStroke);
            _inkStroke = null;
            _inking = false;
            Canvas.ReleasePointerCapture(e.Pointer);
            Canvas.Invalidate();
            BackdropChanged?.Invoke();
        }
    }

    private void OnWheel(object sender, PointerRoutedEventArgs e)
    {
        var pt = e.GetCurrentPoint(Canvas);
        var pos = new Vector2((float)pt.Position.X, (float)pt.Position.Y);
        int delta = pt.Properties.MouseWheelDelta;
        float factor = delta > 0 ? 1.1f : 1f / 1.1f;
        float newZoom = Math.Clamp(_zoom * factor, 0.35f, 3.5f);

        // 以指针位置为锚点缩放
        _offset = pos - (pos - _offset) * (newZoom / _zoom);
        _zoom = newZoom;
        Canvas.Invalidate();
    }

    private void InvalidateAll()
    {
        Canvas.Invalidate();
        BackdropChanged?.Invoke();
    }
}
