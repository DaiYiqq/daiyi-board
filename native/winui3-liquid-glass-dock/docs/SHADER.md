# 液态玻璃 HLSL 着色器 —— 折射 / 色散 / 流动高光

本目录新增了一套**真正的像素着色器**方案，取代之前“半透明 + 模糊 + 白边”的毛玻璃观感：

| 文件 | 作用 |
|---|---|
| `src/LiquidGlassDock/Shaders/LiquidGlassPill.hlsl` | 像素着色器源码（折射 + RGB 色散 + 镜面高光） |
| `src/LiquidGlassDock/Shaders/LiquidGlassPill.cso` | 用 Windows SDK 的 `fxc.exe` 编译好的着色器对象（已随仓库提供） |
| `src/LiquidGlassDock/Glass/LiquidGlassShaderEffect.cs` | 封装 Win2D `PixelShaderEffect` 的 C# 调用 |
| `src/LiquidGlassDock/Controls/LiquidGlassPillButton.xaml(.cs)` | 独立玻璃胶囊按钮控件（内部应用该着色器 + 按压/悬停弹簧动画） |

## 1. 着色器做了什么

`LiquidGlassPill.hlsl` 是 Win2D `PixelShaderEffect` 的 D2D 自定义效果着色器，对背景（白板离屏快照）逐像素做：

1. **边缘折射**：用圆角矩形 SDF 的法线（数值梯度）做 UV 偏移，光在玻璃边缘发生“透镜式”弯曲。中心偏移为 0（通透），边缘偏移最大。
2. **边缘色散（Chromatic Aberration / RGB Split）**：R/G/B 三通道以 `±Dispersion` 的不同折射量分别采样再合成，边缘出现克制的红蓝光晕。
3. **流动镜面高光（Specular）**：Blinn-Phong 高光（光源角度可调）+ 指针跟随的光斑 + 顶部油膜高光带，悬停/滑动时高光在表面流动。
4. **极度通透**：着色器只返回「折射后的背景 + 高光」，**没有厚重底色块**；C# 侧仅叠加 `GlassBaseOpacity=0.15` 的极淡透白。

## 2. 编译 HLSL（改动 .hlsl 后需重新编译）

```powershell
$fxc = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\fxc.exe"
$inc = "C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\um"
& $fxc /T ps_4_0_level_9_3 /E main /D D2D_FULL_SHADER /I $inc `
  "src\LiquidGlassDock\Shaders\LiquidGlassPill.hlsl" `
  /Fo "src\LiquidGlassDock\Shaders\LiquidGlassPill.cso"
```

> 本仓库提供的 `.cso` 已用上述命令编译通过（`fxc` 返回 `compilation object save succeeded`，产物 6336 字节）。若你的 Windows SDK 版本不同，把 `10.0.26100.0` 换成本机版本即可。

## 3. C# 接入

```csharp
var effect = LiquidGlassShaderEffect.Create(
    background: crop,                 // 裁剪后的白板快照
    refractionStrength: 5f,           // 折射（像素）
    dispersion: 0.8f,                 // 色散（像素，RGB 分裂）
    pointerUV: new Vector2(0.5f, 0.5f),
    glareAngleRadians: -52f * MathF.PI / 180f,
    glareRange: 0.30f,
    glareStrength: 0.62f,
    pillHalf: new Vector2(0.48f, 0.48f),
    pillRadius: 0.46f,
    edgeSoftness: 0.06f);

ds.DrawImage(effect, destRect, sourceRectInCrop);
```

着色器属性名与 `.hlsl` 里的全局变量一一对应：`RefractionStrength`、`Dispersion`、`PointerUV`、`GlareAngle`、`GlareRange`、`GlareStrength`、`PillHalf`、`PillRadius`、`EdgeSoftness`。

## 4. 胶囊按钮控件 `LiquidGlassPillButton`

- 每个按钮是**独立的小胶囊**，背景由 `LiquidGlassPill.hlsl` 渲染。
- **悬停**：指针在按钮内移动 → `PointerUV` 更新 → 着色器里的光斑跟随（透镜光斑）。
- **按压**：`ScaleTransform` 用弹簧缩到 0.94，同时折射/高光 `×1.35` 增强；松手弹簧回弹到 1.0。
- **选中**：叠加更亮的透白（`IsSelected`）。
- 用法：
  ```xml
  <controls:LiquidGlassPillButton Glyph="&#xE70F;" Text="画笔" IsSelected="True" />
  ```
  并给 `Backdrop` / `BackdropRoot` / `Parameters` 赋值（与 `GlassDock` 相同）。

## 5. 关键限制与替代方案（诚实说明）

1. **WinUI 3 的 Win2D 中 `PixelShaderEffect` 在 API 文档里标注为 “Work in progress”**，其构造函数签名可能随 Win2D 版本微调。若 `LiquidGlassShaderEffect.cs` 编译报错，按本机 Win2D 的 `PixelShaderEffect` 构造函数重载调整参数顺序/类型。
2. **着色器只能采样“你喂给它的背景纹理”**。和之前一样：WinUI 3 无法直接抓取“某元素背后的应用内容”，所以仍然把白板渲染到离屏 `CanvasRenderTarget`，按按钮矩形裁剪后作为着色器输入。这是平台限制，不是着色器的限制。
3. **兜底**：若自定义着色器在当前 Win2D 版本无法加载，`LiquidGlassEffectRenderer`（内置效果路径：`GaussianBlur + DisplacementMap + 三通道色散 + Saturation + 高光`）仍可运行，作为“无 HLSL 时的近似”。但它不是首选。
4. **绝不**用 `AcrylicBrush` / Mica / 简单 `blur + opacity + border` 冒充——那三者都达不到图 2 的折射与色散。
