// =====================================================================
//  LiquidGlassPill.hlsl  —— 液态玻璃胶囊按钮像素着色器
//  用于 Win2D 的 PixelShaderEffect（D2D 自定义效果着色器）。
//
//  实现三个核心光学效果：
//    1) 边缘折射（Refraction）：用圆角矩形 SDF 法线做 UV 偏移，
//       让光在穿过玻璃边缘时发生“透镜式”弯曲。
//    2) 边缘色散（Chromatic Aberration / RGB Split）：R/G/B 三通道
//       以不同折射量采样，在边缘产生克制的红蓝光晕。
//    3) 流动镜面高光（Specular）：Blinn-Phong 高光 + 指针跟随光斑，
//       像一层油膜沿边缘与表面流动。
// =====================================================================

#define D2D_INPUT_COUNT 1
#define D2D_INPUT0_COMPLEX
#define D2D_ENTRY main

#include "d2d1effecthelpers.hlsli"

// ---------------- 属性（C# 侧经 CanvasEffectProperty 注入） ----------------
float  RefractionStrength;   // 折射强度（像素，越大边缘弯曲越明显）
float  Dispersion;           // 色散强度（像素，RGB 分裂量）
float2 PointerUV;            // 指针 UV(0..1)，(-1,-1)=无指针
float  GlareAngle;           // 主光源角度（弧度，负值来自上方）
float  GlareRange;           // 高光范围/锐度
float  GlareStrength;        // 高光强度
float2 PillHalf;             // 胶囊半尺寸（UV 空间，如 (0.5, 0.5)）
float  PillRadius;           // 圆角半径（UV 空间，近半高时为完整胶囊）
float  EdgeSoftness;         // 边缘柔化宽度（SDF 距离）

// ---------------- 圆角矩形 SDF ----------------
float SdRoundRect(float2 p, float2 b, float r)
{
    float2 q = abs(p) - (b - r);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

D2D_PS_ENTRY(main)
{
    // 当前像素的 UV（0..1）
    float2 uv = D2DGetInputCoordinate(0).xy;
    float2 p = uv - 0.5;                      // 以胶囊中心为原点

    // 圆角矩形 SDF 与边缘因子（中心 0 → 边缘 1）
    float d = SdRoundRect(p, PillHalf, PillRadius);
    float edge = 1.0 - smoothstep(-EdgeSoftness, 0.0, d);

    // 表面法线 = SDF 的数值梯度（向外）
    float eps = 0.005;
    float2 nrm = normalize(float2(
        SdRoundRect(p + float2(eps, 0.0), PillHalf, PillRadius) - SdRoundRect(p - float2(eps, 0.0), PillHalf, PillRadius),
        SdRoundRect(p + float2(0.0, eps), PillHalf, PillRadius) - SdRoundRect(p - float2(0.0, eps), PillHalf, PillRadius)));

    // 折射偏移（像素）：仅边缘有，方向沿法线向外
    float2 refr = nrm * edge * RefractionStrength;

    // 色散：R/G/B 以不同折射量采样（RGB Split）
    float r = D2DSampleInputAtOffset(0, refr * (1.0 + Dispersion)).r;
    float g = D2DSampleInputAtOffset(0, refr).g;
    float b = D2DSampleInputAtOffset(0, refr * (1.0 - Dispersion)).b;
    float3 color = float3(r, g, b);

    // 玻璃表面法线：边缘向外倾斜，中心朝向观察者
    float3 N = normalize(float3(nrm * edge, sqrt(max(0.0, 1.0 - edge * edge))));

    // 主光源镜面高光（Blinn-Phong，光源角度可调）
    float2 L2 = normalize(float2(cos(GlareAngle), sin(GlareAngle)));
    float3 L = normalize(float3(L2, 0.35));
    float3 V = float3(0.0, 0.0, 1.0);
    float3 H = normalize(L + V);
    float spec = pow(saturate(dot(N, H)), 8.0 + GlareRange * 128.0) * GlareStrength;

    // 指针跟随高光（油膜光斑，随指针在表面流动）
    float2 pd = uv - PointerUV;
    float dist2 = dot(pd, pd);
    float pointerGlow = (PointerUV.x >= 0.0) ? exp(-dist2 * 260.0) : 0.0;
    float3 specPointer = pointerGlow * GlareStrength * 0.6 * float3(1.0, 0.98, 0.94);

    // 顶部边缘淡淡的高光带（像一层油膜）
    float topSheen = smoothstep(0.0, 0.5, 0.5 - uv.y) * smoothstep(0.0, 0.6, 1.0 - abs(uv.x - 0.5) * 2.0);
    float3 specTop = topSheen * GlareStrength * 0.18;

    float3 result = color + spec + specPointer + specTop;
    return float4(result, 1.0);
}
