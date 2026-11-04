using System.Numerics;
using Microsoft.Graphics.Canvas;
using Microsoft.Graphics.Canvas.Effects;

namespace LiquidGlassDock.Glass;

/// <summary>
/// 封装 Win2D 的 <see cref="PixelShaderEffect"/>：把编译好的 LiquidGlassPill.cso
/// 应用到背景上，并通过 <see cref="CanvasEffectProperty"/> 注入折射 / 色散 / 高光参数。
///
/// ⚠ 注意：WinUI 3 的 Win2D 中 PixelShaderEffect 在 API 文档里标注为
/// “Work in progress”，其构造函数签名可能随 Win2D 版本微调。若编译报错，
/// 按本机 Win2D 的 PixelShaderEffect 构造函数重载调整（见 IMPLEMENTATION.md 第 7 节）。
/// </summary>
public static class LiquidGlassShaderEffect
{
    private static readonly Lazy<byte[]> ShaderBytes = new(LoadShader);

    /// <summary>构建液态玻璃着色器效果。</summary>
    public static ICanvasImage Create(
        ICanvasImage background,
        float refractionStrength,
        float dispersion,
        Vector2 pointerUV,
        float glareAngleRadians,
        float glareRange,
        float glareStrength,
        Vector2 pillHalf,
        float pillRadius,
        float edgeSoftness)
    {
        var properties = new Dictionary<string, CanvasEffectProperty>
        {
            ["RefractionStrength"] = refractionStrength,
            ["Dispersion"] = dispersion,
            ["PointerUV"] = pointerUV,
            ["GlareAngle"] = glareAngleRadians,
            ["GlareRange"] = glareRange,
            ["GlareStrength"] = glareStrength,
            ["PillHalf"] = pillHalf,
            ["PillRadius"] = pillRadius,
            ["EdgeSoftness"] = edgeSoftness,
        };

        var sources = new ICanvasImage[] { background };

        // 常见重载：PixelShaderEffect(byte[] shaderCode, IReadOnlyDictionary<string, CanvasEffectProperty> properties, IReadOnlyList<ICanvasImage> sources)
        return new PixelShaderEffect(ShaderBytes.Value, properties, sources);
    }

    /// <summary>把 PillHalf / PillRadius 等设为“完整胶囊”（圆角≈半高）。</summary>
    public static void SetPillGeometry(
        float width, float height, out Vector2 pillHalf, out float pillRadius)
    {
        float h = MathF.Max(1f, height);
        pillRadius = MathF.Min(width, height) * 0.5f / MathF.Max(1f, width); // 归一化到 UV（相对宽度）
        pillHalf = new Vector2(0.48f, 0.48f);
        _ = h;
    }

    private static byte[] LoadShader()
    {
        using var stream = typeof(LiquidGlassShaderEffect).Assembly
            .GetManifestResourceStream("LiquidGlassDock.Shaders.LiquidGlassPill.cso")
            ?? throw new InvalidOperationException(
                "未找到嵌入资源 LiquidGlassPill.cso。请在 .csproj 中将其声明为 EmbeddedResource。");
        using var ms = new MemoryStream();
        stream.CopyTo(ms);
        return ms.ToArray();
    }
}
