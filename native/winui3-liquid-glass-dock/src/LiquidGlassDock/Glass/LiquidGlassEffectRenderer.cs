using System.Numerics;
using Microsoft.Graphics.Canvas;
using Microsoft.Graphics.Canvas.Brushes;
using Microsoft.Graphics.Canvas.Effects;
using Microsoft.Graphics.Canvas.Geometry;
using Windows.Foundation;
using Windows.UI;

namespace LiquidGlassDock.Glass;

/// <summary>
/// 液态玻璃效果管线（方案 B：Win2D 内置效果 + Composition 位移贴图，自行构建）。
///
/// 渲染链（真实采样白板离屏快照，不是固定颜色 / 假背景）：
///   白板快照 backdrop
///     → 按工具栏矩形裁剪（含折射外扩余量）
///     → GaussianBlurEffect（中心通透 / 可读性）
///     → DisplacementMapEffect（边缘折射，位移图 = 圆角矩形 SDF × 湍流摆动 × 滑动拉伸）
///     → 可选三通道色散（RGB 轻微分离，仅在边缘）
///     → SaturationEffect（去饱和，避免彩色色块）
///     → 圆角裁切绘制 + 染色叠加 + 边缘暗化 + 镜面高光 + 指针高光
///     → 底部柔和阴影（大扩散、低对比）
/// </summary>
public sealed class LiquidGlassEffectRenderer
{
    private CanvasRenderTarget? _crop;
    private BitmapSize _cropSize;
    private CanvasBitmap? _displacementMap;
    private int _dispWidth;
    private int _dispHeight;

    /// <summary>采样背景矩形区域的平均颜色（低频调用：仅背景变化时，用于“动态染色”）。</summary>
    public Color SampleAverageColor(CanvasRenderTarget backdrop, Rect region)
    {
        var size = backdrop.Size; // DIP
        region = Intersect(region, new Rect(0, 0, size.Width, size.Height));
        if (region.Width <= 0 || region.Height <= 0)
            return Color.FromArgb(255, 245, 246, 248);

        const int w = 4, h = 4;
        using var small = new CanvasRenderTarget(CanvasDevice.GetSharedDevice(), w, h, 96f);
        using (var ds = small.CreateDrawingSession())
        {
            ds.DrawImage(backdrop, new Rect(0, 0, w, h), region, 1f, CanvasImageInterpolation.HighQualityCubic);
        }

        var colors = small.GetPixelColors();
        double r = 0, g = 0, b = 0;
        int n = 0;
        foreach (var c in colors) { r += c.R; g += c.G; b += c.B; n++; }
        if (n == 0) return Color.FromArgb(255, 245, 246, 248);
        return Color.FromArgb(255, (byte)(r / n), (byte)(g / n), (byte)(b / n));
    }

    /// <summary>对颜色做去饱和（Rec.709 亮度，lerp 向灰）。</summary>
    public static Color Desaturate(Color c, float amount)
    {
        float l = 0.2126f * c.R + 0.7152f * c.G + 0.0722f * c.B;
        byte r = (byte)Math.Clamp(c.R + (l - c.R) * amount, 0, 255);
        byte g = (byte)Math.Clamp(c.G + (l - c.G) * amount, 0, 255);
        byte b = (byte)Math.Clamp(c.B + (l - c.B) * amount, 0, 255);
        return Color.FromArgb(c.A, r, g, b);
    }

    /// <summary>
    /// 绘制一帧玻璃。
    /// </summary>
    /// <param name="ds">工具栏玻璃 CanvasControl 的绘制会话（DIP 空间）。</param>
    /// <param name="backdrop">白板离屏快照（DIP 坐标，与窗口同尺寸）。</param>
    /// <param name="sourceRect">工具栏在快照中的矩形（DIP）。滑动偏移在内部叠加。</param>
    /// <param name="destRect">工具栏在自身局部坐标中的绘制矩形（DIP）。</param>
    /// <param name="cornerRadius">连续圆角半径（DIP）。</param>
    /// <param name="p">参数快照。</param>
    /// <param name="pointerLocal">指针在工具栏局部坐标（DIP），用于高光跟随。</param>
    /// <param name="slideOffset">当前弹性横向偏移（DIP，正=右移）。</param>
    /// <param name="slideVelocity">滑动速度（DIP/s，用于边缘折射拉伸）。</param>
    /// <param name="timeSec">动画时间（秒），驱动液态摆动。</param>
    /// <param name="tintColor">已去饱和的背景平均色（用于染色叠加）。</param>
    /// <param name="isWriting">书写态：降低高光与染色。</param>
    public void Draw(
        CanvasDrawingSession ds,
        CanvasRenderTarget backdrop,
        Rect sourceRect,
        Rect destRect,
        float cornerRadius,
        LiquidGlassParameters p,
        Vector2 pointerLocal,
        float slideOffset,
        float slideVelocity,
        float timeSec,
        Color tintColor,
        bool isWriting)
    {
        // 书写态：按比例压低高光与染色，避免打扰书写。
        float glareFactor = p.GlareFactor * (isWriting ? p.WritingDimGlare : 1f);
        float tintStrength = p.TintStrength * (isWriting ? p.WritingDimTint : 1f);

        // 1) 采样矩形随滑动偏移移动，保证“背景采样随面板位置实时更新”。
        Rect effectiveSource = new Rect(sourceRect.X + slideOffset, sourceRect.Y, sourceRect.Width, sourceRect.Height);

        float margin = Math.Max(28f, p.RefFactor * 220f);
        Rect cropRect = new Rect(
            effectiveSource.X - margin,
            effectiveSource.Y - margin,
            effectiveSource.Width + margin * 2,
            effectiveSource.Height + margin * 2);

        var crop = EnsureCrop(backdrop, cropRect);

        // 2) 中心模糊（保持中心通透，仅做低频扩散）。
        var blur = new GaussianBlurEffect
        {
            Source = crop,
            BlurAmount = p.CenterBlur,
            Optimization = EffectOptimization.Speed,
            BorderMode = EffectBorderMode.Soft,
        };

        // 3) 位移贴图（边缘折射 + 液态摆动 + 滑动拉伸）。
        var dispMap = EnsureDisplacementMap(
            (int)Math.Max(96, destRect.Width),
            (int)Math.Max(32, destRect.Height),
            cornerRadius,
            p,
            timeSec,
            slideVelocity);

        float amount = p.RefFactor * (float)destRect.Height * 2.5f;

        ICanvasImage refracted;
        if (!p.LowQuality && p.Dispersion > 0.0005f)
        {
            refracted = BuildDispersion(blur, dispMap, amount, p.Dispersion);
        }
        else
        {
            refracted = new DisplacementMapEffect
            {
                Source = blur,
                Displacement = dispMap,
                Amount = amount,
                XChannelSelect = EffectChannelSelect.Red,
                YChannelSelect = EffectChannelSelect.Green,
            };
        }

        // 4) 去饱和。
        var graded = new SaturationEffect
        {
            Source = refracted,
            Saturation = Math.Clamp(1f - p.Desaturation, 0f, 1f),
        };

        // 5) 阴影：低对比、大扩散（先画，玻璃压在上面）。
        DrawSoftShadow(ds, destRect, cornerRadius, slideOffset, 16f, 0.22f);

        // 6) 玻璃主体（圆角裁切）。
        var geometry = CanvasGeometry.CreateRoundedRectangle(ds, destRect, cornerRadius, cornerRadius);
        using (ds.CreateLayer(1f, geometry))
        {
            // 折射 + 去饱和背景
            var srcInCrop = new Rect(margin, margin, destRect.Width, destRect.Height);
            ds.DrawImage(graded, destRect, srcInCrop, 1f, CanvasImageInterpolation.HighQualityCubic);

            // 动态染色（去饱和后的背景平均色，轻微叠加）
            if (tintStrength > 0.002f)
                ds.FillRoundedRectangle(destRect, cornerRadius, cornerRadius,
                    Color.FromArgb((byte)Math.Clamp(tintStrength * 255f, 0, 255), tintColor.R, tintColor.G, tintColor.B));

            // 边缘暗化（内侧轻微变暗，与外缘高光形成“玻璃厚度”层次）
            DrawEdgeDarkening(ds, destRect, cornerRadius, p);

            // 镜面高光（顶部主光源 + 指针跟随 + 四周细边）
            DrawGlare(ds, destRect, cornerRadius, p, pointerLocal, glareFactor);
        }
    }

    // ---------------------------------------------------------------- helpers

    private CanvasRenderTarget EnsureCrop(CanvasRenderTarget backdrop, Rect cropRect)
    {
        var bs = backdrop.Size;
        cropRect = Intersect(cropRect, new Rect(0, 0, bs.Width, bs.Height));
        int w = Math.Max(1, (int)MathF.Ceiling(cropRect.Width));
        int h = Math.Max(1, (int)MathF.Ceiling(cropRect.Height));

        if (_crop == null || _cropSize.Width != w || _cropSize.Height != h)
        {
            _crop?.Dispose();
            _crop = new CanvasRenderTarget(CanvasDevice.GetSharedDevice(), cropRect.Width, cropRect.Height, backdrop.Dpi);
            _cropSize = new BitmapSize { Width = (uint)w, Height = (uint)h };
        }

        using var ds = _crop.CreateDrawingSession();
        ds.Clear(Color.FromArgb(0, 0, 0, 0));
        ds.DrawImage(backdrop, new Rect(0, 0, cropRect.Width, cropRect.Height), cropRect, 1f, CanvasImageInterpolation.Linear);
        return _crop;
    }

    private CanvasBitmap EnsureDisplacementMap(
        int width, int height, float cornerRadius, LiquidGlassParameters p, float timeSec, float slideVelocity)
    {
        int w = Math.Min(320, Math.Max(96, width / 3));
        int h = Math.Min(128, Math.Max(32, height / 3));

        if (_displacementMap == null || _dispWidth != w || _dispHeight != h)
        {
            _displacementMap?.Dispose();
            _displacementMap = CreateDisplacementMap(w, h, cornerRadius, p, timeSec, slideVelocity);
            _dispWidth = w;
            _dispHeight = h;
            return _displacementMap;
        }

        // 液态摆动 + 滑动拉伸是逐帧量，直接重新上传（低分辨率，开销可忽略）。
        using var old = _displacementMap;
        _displacementMap = CreateDisplacementMap(w, h, cornerRadius, p, timeSec, slideVelocity);
        return _displacementMap;
    }

    /// <summary>
    /// 生成位移贴图：R = X 位移，G = Y 位移（0.5 为中性）。
    /// 位移场 = 圆角矩形 SDF 边缘权重 ×（液态摆动 + 滑动方向拉伸）。
    /// </summary>
    private CanvasBitmap CreateDisplacementMap(
        int w, int h, float cornerRadius, LiquidGlassParameters p, float timeSec, float slideVelocity)
    {
        var bytes = new byte[w * h * 4];
        float aspect = (float)w / h;
        float r = Math.Clamp(cornerRadius / Math.Max(1f, h), 0f, 0.48f); // 归一化圆角
        float thickness = Math.Clamp(p.RefThickness, 0.02f, 0.6f);

        float slide = Math.Clamp(slideVelocity / 2400f, -1f, 1f);

        for (int y = 0; y < h; y++)
        {
            for (int x = 0; x < w; x++)
            {
                float u = (x + 0.5f) / w;
                float v = (y + 0.5f) / h;
                float px = u * aspect, py = v; // 高度归一化空间

                // 圆角矩形 SDF（高度归一化），负值在内部
                float qx = MathF.Abs(px - aspect * 0.5f) - (aspect * 0.5f - r);
                float qy = MathF.Abs(py - 0.5f) - (0.5f - r);
                float ddx = MathF.Max(qx, 0f), ddy = MathF.Max(qy, 0f);
                float dist = MathF.Sqrt(ddx * ddx + ddy * ddy) + MathF.Min(MathF.Max(qx, qy), 0f) - r;

                // 边缘权重：中心 0 → 边缘 1
                float e = SmoothStep(-thickness, 0f, dist);

                // 低频液态摆动
                float wob = MathF.Sin(u * MathF.Tau * 1.6f + timeSec * 1.1f)
                          * MathF.Cos(v * MathF.Tau * 1.1f - timeSec * 0.9f)
                          + 0.5f * MathF.Sin((u + v) * MathF.Tau * 0.7f + timeSec * 1.6f);
                float wob2 = MathF.Sin(u * MathF.Tau * 1.2f - timeSec * 0.8f)
                           + MathF.Cos(v * MathF.Tau * 1.5f + timeSec * 1.3f);

                // 滑动方向拉伸 + 顶部光源向下微弯
                float dx = e * (slide * 0.55f + wob * 0.30f);
                float dy = e * (wob2 * 0.22f - 0.22f);

                int i = (y * w + x) * 4;
                bytes[i + 0] = 128;                                              // B
                bytes[i + 1] = (byte)Math.Clamp(128f + dy * 127f, 0, 255);       // G = Y 位移
                bytes[i + 2] = (byte)Math.Clamp(128f + dx * 127f, 0, 255);       // R = X 位移
                bytes[i + 3] = 255;                                              // A
            }
        }

        return CanvasBitmap.CreateFromBytes(
            CanvasDevice.GetSharedDevice(), bytes, w, h,
            DirectXPixelFormat.B8G8R8A8UIntNormalized, 96f);
    }

    /// <summary>三通道色散：R/G/B 以略微不同的折射量位移后重新合成，仅在边缘产生克制的色差。</summary>
    private ICanvasImage BuildDispersion(IGraphicsEffectSource blur, CanvasBitmap dispMap, float amount, float dispersion)
    {
        var dispR = new DisplacementMapEffect
        {
            Source = blur, Displacement = dispMap, Amount = amount * (1f + dispersion),
            XChannelSelect = EffectChannelSelect.Red, YChannelSelect = EffectChannelSelect.Green,
        };
        var dispG = new DisplacementMapEffect
        {
            Source = blur, Displacement = dispMap, Amount = amount,
            XChannelSelect = EffectChannelSelect.Red, YChannelSelect = EffectChannelSelect.Green,
        };
        var dispB = new DisplacementMapEffect
        {
            Source = blur, Displacement = dispMap, Amount = amount * (1f - dispersion),
            XChannelSelect = EffectChannelSelect.Red, YChannelSelect = EffectChannelSelect.Green,
        };

        var r = new ColorMatrixEffect { Source = dispR, ColorMatrix = KeepChannel(0) };
        var g = new ColorMatrixEffect { Source = dispG, ColorMatrix = KeepChannel(1) };
        var b = new ColorMatrixEffect { Source = dispB, ColorMatrix = KeepChannel(2) };

        return new CompositeEffect { Mode = CanvasComposite.Add, Sources = { r, g, b } };
    }

    /// <summary>仅保留单通道的颜色矩阵（rows=输入 R,G,B,A,offset；cols=输出 R,G,B,A）。</summary>
    private static Matrix5x4 KeepChannel(int channel)
    {
        var m = new Matrix5x4();
        // 输出 A' = A
        m.M44 = 1f;
        // 仅让输入 channel 行映射到输出 channel 列
        switch (channel)
        {
            case 0: m.M11 = 1f; break; // 保留 R
            case 1: m.M22 = 1f; break; // 保留 G
            case 2: m.M33 = 1f; break; // 保留 B
        }
        return m;
    }

    private static void DrawSoftShadow(CanvasDrawingSession ds, Rect rect, float cornerRadius, float slideOffset, float blurRadius, float alpha)
    {
        float pad = blurRadius * 2f;
        var shadowRect = new Rect(rect.X - pad + slideOffset, rect.Y - pad + 8f, rect.Width + pad * 2, rect.Height + pad * 2);
        using var rt = new CanvasRenderTarget(ds, shadowRect.Width, shadowRect.Height);
        using (var sds = rt.CreateDrawingSession())
        {
            sds.FillRoundedRectangle(
                new Rect(pad, pad, rect.Width, rect.Height), cornerRadius, cornerRadius,
                Color.FromArgb((byte)(alpha * 255f), 0, 0, 0));
        }
        using var geom = CanvasGeometry.CreateRoundedRectangle(ds, shadowRect, cornerRadius, cornerRadius);
        using (ds.CreateLayer(1f, geom))
        {
            var blur = new GaussianBlurEffect { Source = rt, BlurAmount = blurRadius };
            ds.DrawImage(blur, shadowRect, new Rect(0, 0, shadowRect.Width, shadowRect.Height), 1f, CanvasImageInterpolation.Linear);
        }
    }

    private static void DrawEdgeDarkening(CanvasDrawingSession ds, Rect rect, float cornerRadius, LiquidGlassParameters p)
    {
        // 内侧一圈轻微暗化，与外缘高光形成“厚度”对比。用多层内缩描边近似暗化过渡。
        float inset = 3f;
        var inner = new Rect(rect.X + inset, rect.Y + inset, rect.Width - inset * 2, rect.Height - inset * 2);
        ds.DrawRoundedRectangle(inner, Math.Max(1f, cornerRadius - inset), Math.Max(1f, cornerRadius - inset),
            Color.FromArgb(16, 0, 0, 0), 5f);
    }

    private static void DrawGlare(CanvasDrawingSession ds, Rect rect, float cornerRadius, LiquidGlassParameters p, Vector2 pointerLocal, float glareFactor)
    {
        if (glareFactor <= 0.001f) return;

        float w = (float)rect.Width, h = (float)rect.Height;
        float topY = (float)rect.Y;
        float range = h * Math.Clamp(p.GlareRange, 0.02f, 0.9f);

        // 顶部主光源：线性渐变从上方白色高光衰减到透明。
        var stops = new CanvasGradientStop[]
        {
            new CanvasGradientStop { Color = Color.FromArgb((byte)(glareFactor * 150f), 255, 255, 255), Position = 0f },
            new CanvasGradientStop { Color = Color.FromArgb(0, 255, 255, 255), Position = 1f },
        };
        using var topBrush = new CanvasLinearGradientBrush(ds, stops);
        topBrush.StartPoint = new Vector2(0, topY);
        topBrush.EndPoint = new Vector2(0, topY + range);
        ds.FillRoundedRectangle(rect, cornerRadius, cornerRadius, topBrush);

        // 四周细镜面边（最亮在上边缘，其余略弱）。
        ds.DrawRoundedRectangle(rect, cornerRadius, cornerRadius,
            Color.FromArgb((byte)(glareFactor * 110f), 255, 255, 255), 1.2f);

        // 指针跟随高光：多层椭圆叠加近似柔和光斑。
        if (pointerLocal.X >= 0 && pointerLocal.Y >= 0)
        {
            float gx = pointerLocal.X, gy = Math.Clamp(pointerLocal.Y, (float)rect.Y, (float)(rect.Y + h));
            ds.FillEllipse(new Rect(gx - 70, gy - 70, 140, 140), Color.FromArgb((byte)(glareFactor * 26f), 255, 255, 255));
            ds.FillEllipse(new Rect(gx - 40, gy - 40, 80, 80), Color.FromArgb((byte)(glareFactor * 34f), 255, 255, 255));
            ds.FillEllipse(new Rect(gx - 18, gy - 18, 36, 36), Color.FromArgb((byte)(glareFactor * 46f), 255, 255, 255));
        }
    }

    private static float SmoothStep(float edge0, float edge1, float x)
    {
        float t = Math.Clamp((x - edge0) / (edge1 - edge0), 0f, 1f);
        return t * t * (3f - 2f * t);
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
