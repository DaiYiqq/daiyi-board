using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace LiquidGlassDock.Glass;

/// <summary>
/// 液态玻璃效果的全部可调参数。命名刻意对齐 LiquidGlassBrush 已有参数风格
/// （RefThickness / RefFactor / GlareAngle / GlareFactor / GlareRange），
/// 其余为本次交互新增。所有属性可双向绑定到调参面板。
/// </summary>
public sealed class LiquidGlassParameters : INotifyPropertyChanged
{
    // ---------------- 折射 ----------------
    private float _refThickness = 0.18f;
    /// <summary>边缘折射带厚度（占按钮栏高度的比例，0..1）。越大边缘透镜带越宽。</summary>
    public float RefThickness { get => _refThickness; set => Set(ref _refThickness, value); }

    private float _refFactor = 0.045f;
    /// <summary>折射强度（位移量，归一化）。越大边缘弯曲越明显。</summary>
    public float RefFactor { get => _refFactor; set => Set(ref _refFactor, value); }

    private float _dispersion = 0.012f;
    /// <summary>边缘色散（RGB 色差）强度，必须保持极低，避免“脏边”。</summary>
    public float Dispersion { get => _dispersion; set => Set(ref _dispersion, value); }

    // ---------------- 高光 ----------------
    private float _glareAngle = -52f;
    /// <summary>主高光方向（度，0=水平向右，负值=来自上方）。</summary>
    public float GlareAngle { get => _glareAngle; set => Set(ref _glareAngle, value); }

    private float _glareFactor = 0.62f;
    /// <summary>镜面高光主强度（0..1）。</summary>
    public float GlareFactor { get => _glareFactor; set => Set(ref _glareFactor, value); }

    private float _glareRange = 0.30f;
    /// <summary>高光从顶边向下衰减的范围（占高度比例）。</summary>
    public float GlareRange { get => _glareRange; set => Set(ref _glareRange, value); }

    private float _glareFollow = 0.16f;
    /// <summary>高光跟随指针的平滑系数（越大越“跟手”，越小越“顺滑”）。</summary>
    public float GlareFollow { get => _glareFollow; set => Set(ref _glareFollow, value); }

    // ---------------- 染色 ----------------
    private float _glassBaseOpacity = 0.15f;
    /// <summary>玻璃底色强度（0..1）。默认极低——“极度通透”，只留一层极淡的透白，不做厚重底色块。</summary>
    public float GlassBaseOpacity { get => _glassBaseOpacity; set => Set(ref _glassBaseOpacity, value); }

    private float _tintStrength = 0.12f;
    /// <summary>采样背景色并融入自身色调的强度（0..1）。</summary>
    public float TintStrength { get => _tintStrength; set => Set(ref _tintStrength, value); }

    private float _desaturation = 0.55f;
    /// <summary>去饱和程度（0..1，1=完全灰）。避免彩色内容出现刺眼色块。</summary>
    public float Desaturation { get => _desaturation; set => Set(ref _desaturation, value); }

    // ---------------- 模糊 ----------------
    private float _centerBlur = 10f;
    /// <summary>中心区域背景模糊半径（像素）。中心保持可读性。</summary>
    public float CenterBlur { get => _centerBlur; set => Set(ref _centerBlur, value); }

    // ---------------- 滑动 ----------------
    private float _springStiffness = 560f;
    /// <summary>回弹刚度（越大回弹越快越硬）。</summary>
    public float SpringStiffness { get => _springStiffness; set => Set(ref _springStiffness, value); }

    private float _springDamping = 26f;
    /// <summary>回弹阻尼（越大越快停下，避免震荡）。</summary>
    public float SpringDamping { get => _springDamping; set => Set(ref _springDamping, value); }

    private float _maxSlideOffset = 36f;
    /// <summary>横向滑动允许的最大弹性偏移（像素）。</summary>
    public float MaxSlideOffset { get => _maxSlideOffset; set => Set(ref _maxSlideOffset, value); }

    // ---------------- 书写状态 ----------------
    private float _writingDimGlare = 0.35f;
    /// <summary>书写时高光强度降低到原值的比例。</summary>
    public float WritingDimGlare { get => _writingDimGlare; set => Set(ref _writingDimGlare, value); }

    private float _writingDimTint = 0.40f;
    /// <summary>书写时染色强度降低到原值的比例。</summary>
    public float WritingDimTint { get => _writingDimTint; set => Set(ref _writingDimTint, value); }

    // ---------------- 性能 ----------------
    private bool _lowQuality = false;
    /// <summary>简化玻璃模式：关掉色散三通道，降低位移图分辨率。</summary>
    public bool LowQuality { get => _lowQuality; set => Set(ref _lowQuality, value); }

    // ---------------- 渲染路径 ----------------
    private bool _useShader = true;
    /// <summary>true=HLSL 像素着色器（折射 + 色散 + 高光，首选）；false=内置效果管线（兜底）。</summary>
    public bool UseShader { get => _useShader; set => Set(ref _useShader, value); }

    // ---------------- 着色器（HLSL 像素着色器参数） ----------------
    private float _refractionStrength = 5.0f;
    /// <summary>折射强度（像素）。越大边缘透镜弯曲越明显。</summary>
    public float RefractionStrength { get => _refractionStrength; set => Set(ref _refractionStrength, value); }

    private float _dispersionPx = 0.8f;
    /// <summary>色散强度（像素，RGB 分裂量）。边缘红蓝光晕，保持克制。</summary>
    public float DispersionPx { get => _dispersionPx; set => Set(ref _dispersionPx, value); }

    private float _pillRadius = 0.46f;
    /// <summary>胶囊圆角半径（归一化 UV，近 0.5 = 完整胶囊）。</summary>
    public float PillRadius { get => _pillRadius; set => Set(ref _pillRadius, value); }

    private float _edgeSoftness = 0.06f;
    /// <summary>边缘柔化宽度（SDF 距离，越小折射带越锐利）。</summary>
    public float EdgeSoftness { get => _edgeSoftness; set => Set(ref _edgeSoftness, value); }

    public event PropertyChangedEventHandler? PropertyChanged;

    private void Set<T>(ref T field, T value, [CallerMemberName] string? name = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value)) return;
        field = value;
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
    }

    /// <summary>返回一份拷贝，便于渲染线程快照读取，避免半帧参数跳动。</summary>
    public LiquidGlassParameters Clone() => (LiquidGlassParameters)MemberwiseClone();
}
