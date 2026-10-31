# DY Board 液态玻璃底部工具栏 —— 实现说明

本文对应交付的 WinUI 3 原生 Demo（`src/LiquidGlassDock`），按任务要求逐项给出：方案对比、组件结构、完整代码位置、滑动交互、背景采样、性能与降级、调试与常见问题。

---

## 1. 方案对比与推荐

### 1.1 方案 A：直接使用 LiquidGlassWinUI 的 `LiquidGlassBrush`

[LiquidGlassWinUI](https://www.nuget.org/packages/LiquidGlassWinUI)（作者 luckyelysia，NuGet 包约 1.0.3）是一个把 iOS 26 液态玻璃效果移植到 WinUI 3 的开源库，核心是一个 `LiquidGlassBrush`（`XamlCompositionBrushBase` 派生），参数命名即为 `RefThickness / RefFactor / GlareAngle / GlareFactor / GlareRange` 这一类折射 + 高光模型。

| 维度 | 评价 |
|---|---|
| 集成成本 | 低：装包、把 `LiquidGlassBrush` 当背景刷用即可 |
| 参数风格 | 与任务要求高度一致（可直接复用命名） |
| **背景采样来源** | 采样系统桌面背景 / 壁纸（本质是 `CompositionBackdropBrush` / Win2D 对 backdrop 的近似），**不是同一窗口里按钮栏背后的白板内容** |
| **滑动交互** | 刷子暴露的是「场景级」参数（折射厚度/强度、高光角度/强度/范围），**没有**「高光中心跟随指针位置」「折射方向随滑动各向异性拉伸」的动态入口；要跟着手指走，只能整体重设参数，做不到逐帧精确驱动 |
| DWM 依赖 | 依赖系统合成器提供 backdrop 纹理，跨版本行为不完全一致 |
| 性能风险 | 现成管线，性能由其内部实现决定；但**无法**为「低配降级」单独裁剪色散/折射 |

**结论**：方案 A 能快速得到「静态玻璃观感」，但**无法满足本任务的两条硬指标**——①真实采样按钮栏背后的白板内容；②横向滑动时折射/高光实时跟随。故不作为主方案。

### 1.2 方案 B：Win2D 位移贴图 + 径向边缘遮罩，自行构建效果管线（**本 Demo 采用**）

用 Win2D 内置效果自行搭链：`GaussianBlur → DisplacementMap（位移贴图）→ 三通道色散 → Saturation → 染色 → 高光`。位移贴图由「圆角矩形 SDF 边缘权重 × 低频液态摆动 × 滑动方向拉伸」逐帧生成；高光用渐变 + 多层椭圆直接画。

| 维度 | 评价 |
|---|---|
| 背景采样来源 | **真实**：白板渲染到离屏 `CanvasRenderTarget`，玻璃按自己的矩形裁剪采样这张快照 |
| 滑动交互 | 完全可控：位移贴图每帧重算，可注入滑动速度做方向拉伸；高光中心直接绑定指针坐标 |
| 效果自由度 | 折射厚度/折射率/色散/高光角度强度范围/去饱和/中心模糊/弹簧参数全部外露，逐项可调、可降级 |
| DWM 依赖 | **低**：不依赖系统 backdrop，只依赖 Direct2D/Win2D 正常渲染管线 |
| 性能风险 | 可控：低配关掉三通道色散、缩小位移图、降低重绘频率即可 |
| 集成成本 | 高：需要自己写渲染器与交互（本 Demo 已写全） |

### 1.3 为什么不选「Mica / Acrylic / 普通 backdrop-filter」

- WinUI 3 的 `MicaController` / `DesktopAcrylicController` 采样的是**壁纸 / 窗口底衬**，不是应用内内容。
- `CompositionBackdropBrush` 在 WinUI 3 里只能拿到系统提供的 backdrop，**没有**「把某元素背后的应用内容抓成纹理」的官方 API（UWP 时代的全局 composition 已不可用，见 [microsoft-ui-xaml#5025](https://github.com/microsoft/microsoft-ui-xaml/issues/5025)）。

**推荐：方案 B**。它的关键前提是——白板是你自己的绘制内容，你可以「同一份绘制同时画到屏幕和一张离屏纹理」，于是玻璃就能**真实采样**这张纹理。这是唯一同时满足「真实采样白板 + 滑动折射 + 高光跟随」的可行路径。

---

## 2. 按钮栏组件结构（XAML 层级 + 按钮布局）

```
MainWindow (Window)
└─ Grid x:Name="Root"
   ├─ WhiteboardView (UserControl)                 ← 白板，填满窗口
   │  └─ CanvasControl x:Name="Canvas"             ← Win2D 绘制白板 + 更新离屏快照
   ├─ GlassDock (UserControl)                      ← 底部居中，自动按内容定宽
   │  └─ Grid x:Name="LayoutRoot"
   │     ├─ CanvasControl x:Name="GlassSurface"    ← 画玻璃（采样白板快照），IsHitTestVisible=False
   │     └─ StackPanel x:Name="ButtonRow"          ← 透明按钮行，玻璃连续透在下面
   │        ├─ Button(BtnSelect) 选择  → Pan 工具
   │        ├─ Button(BtnPen)    画笔  → 墨迹(深色)
   │        ├─ Button(BtnEraser) 橡皮  → 墨迹(底色)
   │        ├─ Button(BtnNote)   便签  → 场景加一张便签
   │        ├─ Button(BtnShape)  形状  → 场景加一个形状
   │        └─ Button(BtnText)   文字  → 占位(暂以便签演示)
   ├─ Button(SettingsToggle) 右上角齿轮            ← 开关参数面板
   └─ SettingsPanel (UserControl)                  ← 参数面板，{Binding} 双向绑定
```

要点：

- **玻璃是一整块连续表面**，由 `GlassSurface` 一次画成；按钮本身 `Background=Transparent`，只承载图标/文字，不打断玻璃连续感。
- 按钮行 `Padding="14,9"` 留出边缘，让折射带和高光落在按钮之外，保证图标区通透可读。
- 图标用内置 `FontIcon`（Segoe MDL2），无第三方图标依赖；可随意替换为任意 Fluent 图标。
- `GlassDock` 不设固定宽度，按内容自适应，`HorizontalAlignment="Center"` 让其悬浮在底部中央；窗口变窄时它是「横条」，而非独立浮窗/Dock。

---

## 3. 完整代码

完整工程见 `src/LiquidGlassDock/`，核心文件与职责：

| 文件 | 职责 |
|---|---|
| `Glass/LiquidGlassParameters.cs` | 全部可调参数（折射/高光/染色/模糊/滑动/书写/性能），`INotifyPropertyChanged`，`Clone()` 供渲染线程快照 |
| `Glass/GlassSpring.cs` | 欠阻尼弹簧积分器（半隐式欧拉，帧率无关） |
| `Glass/LiquidGlassEffectRenderer.cs` | 效果管线（裁剪→模糊→位移折射→色散→去饱和→染色→高光→阴影） |
| `Whiteboard/WhiteboardScene.cs` | 白板内容模型（墨迹/便签/形状）+ 纯绘制（屏幕与快照共用） |
| `Controls/WhiteboardView.xaml(.cs)` | 画布控件：渲染到屏幕 + 离屏快照，平移/缩放/书写 |
| `Controls/GlassDock.xaml(.cs)` | 玻璃工具栏：指针交互、弹簧物理、玻璃绘制、工具选择 |
| `Controls/SettingsPanel.xaml(.cs)` | 参数调参面板 |
| `MainWindow.xaml(.cs)` | 组装与接线 |

### 3.1 参数类（API 风格对齐 LiquidGlassBrush 命名）

```csharp
public sealed class LiquidGlassParameters : INotifyPropertyChanged
{
    // 折射
    public float RefThickness { get; set; } = 0.18f; // 边缘折射带厚度(占高度比例)
    public float RefFactor    { get; set; } = 0.045f;// 折射强度(位移量)
    public float Dispersion   { get; set; } = 0.012f;// 色散强度(极低)
    // 高光
    public float GlareAngle   { get; set; } = -52f;  // 主高光方向(度)
    public float GlareFactor  { get; set; } = 0.62f; // 高光强度
    public float GlareRange   { get; set; } = 0.30f; // 高光向下衰减范围(占高度)
    public float GlareFollow  { get; set; } = 0.16f; // 指针跟随平滑系数
    // 染色
    public float TintStrength { get; set; } = 0.16f; // 染色强度
    public float Desaturation { get; set; } = 0.55f; // 去饱和(0..1)
    // 模糊 / 滑动 / 书写 / 性能
    public float CenterBlur       { get; set; } = 10f;
    public float SpringStiffness  { get; set; } = 560f;
    public float SpringDamping    { get; set; } = 26f;
    public float MaxSlideOffset   { get; set; } = 36f;
    public float WritingDimGlare  { get; set; } = 0.35f;
    public float WritingDimTint   { get; set; } = 0.40f;
    public bool  LowQuality       { get; set; } = false;
}
```

### 3.2 效果管线关键实现（`LiquidGlassEffectRenderer.Draw`）

```csharp
// 1) 采样矩形随滑动偏移移动 → 背景采样随面板位置实时更新
Rect effectiveSource = sourceRect; effectiveSource.X += slideOffset;
// 2) 裁剪(含折射外扩余量) + GaussianBlur(中心通透)
var blur = new GaussianBlurEffect { Source = crop, BlurAmount = p.CenterBlur, BorderMode = Soft };
// 3) 位移折射：位移图 = SDF边缘权重 × 液态摆动 × 滑动拉伸
var dispMap = CreateDisplacementMap(...);            // R=X位移, G=Y位移
var refracted = new DisplacementMapEffect { Source = blur, Displacement = dispMap, Amount = ..., XChannelSelect = Red, YChannelSelect = Green };
// 4) 可选三通道色散(R/G/B 略微不同折射量再合成)
if (!p.LowQuality) refracted = BuildDispersion(...);
// 5) 去饱和
var graded = new SaturationEffect { Source = refracted, Saturation = 1 - p.Desaturation };
// 6) 圆角裁切绘制 + 染色叠加 + 边缘暗化 + 镜面高光
```

位移贴图的数学（`CreateDisplacementMap`）：

- 把工具栏归一化到「高=1、宽=aspect」空间，算**圆角矩形 SDF** `dist`（内部为负）。
- 边缘权重 `e = smoothstep(-RefThickness, 0, dist)`：中心 0 → 边缘 1，于是**中心不透、边缘折射强**。
- 位移 `dx = e·(slide·0.55 + wobble·0.30)`，`dy = e·(wobble2·0.22 − 0.22)`（顶部光源向下微弯）。
- 编码进 R/G 通道：`R = 128 + dx·127`，`G = 128 + dy·127`，`0.5` 为中性；`DisplacementMapEffect.Amount = RefFactor · 高度 · 2.5` 换算成像素级折射量。

色散（`BuildDispersion`）：同一张位移图以 `amount·(1±Dispersion)` 各跑三次位移，再用 `ColorMatrixEffect` 分别只留 R/G/B，最后 `CompositeEffect { Mode = Add }` 合成。`Matrix5x4` 方向约定：**行 = 输入 R,G,B,A,offset，列 = 输出 R,G,B,A**。

---

## 4. 滑动交互实现说明

状态与物理（`GlassDock.xaml.cs`）：

- `_slideOffset`：当前弹性横向偏移（DIP）。拖动时 `offset += dx·0.85` 并夹在 `±MaxSlideOffset·1.5`；松手后交给弹簧回弹到 0。
- `_slideVelocity`：由相邻两次 `PointerMoved` 的 `dx/dt` 估算（DIP/s），注入位移贴图做「滑动方向折射拉伸」。
- `GlassSpring`（半隐式欧拉）：`a = k·(target − pos) − c·vel; vel += a·dt; pos += vel·dt`，接近目标时吸合，避免微抖。
- `DispatcherQueueTimer`（16ms）驱动逐帧：步进滑动弹簧、衰减速度、步进高光跟随弹簧、`GlassSurface.Invalidate()`；无运动时自动停止计时器。
- 高光跟随：`_pointerX` 经第二个弹簧平滑逼近指针 X（`GlareFollow` 控制平滑度），Y 直接跟随；指针离开时设为 −1 隐藏高光。
- 书写态：`IsWritingProvider = () => Board.IsInking`，绘制时 `glareFactor = GlareFactor · WritingDimGlare`、`tintStrength = TintStrength · WritingDimTint`，实现「书写时退后」。

回弹曲线是弹簧自然曲线（阻尼振荡→静止），**无线性生硬过渡**。拖动中玻璃、按钮、阴影一起偏移，采样的源矩形同步平移，因此**不会出现背景撕裂/采样错位**。

---

## 5. 白板画布背景采样的接入方式

这是整件事的关键，分三层说明：

1. **为什么不能直接「抓背后内容」**：WinUI 3 的 `CompositionBackdropBrush` 只提供系统背景（壁纸/窗口底衬），拿不到「同一窗口里某元素背后的应用像素」。所以不能用它。

2. **本 Demo 的接入**：
   - `WhiteboardView` 的 `Draw` 里，除了画屏幕，还把**同一份 `WhiteboardScene` 渲染到一张 `CanvasRenderTarget Snapshot`**（尺寸/DPI 与窗口一致，坐标原点 = 窗口左上角）。
   - 每次白板内容变化、平移、缩放、书写，都会更新 `Snapshot` 并触发 `BackdropChanged` → `Dock.Backdrop = Snapshot` → `Dock.InvalidateBackdrop()`。
   - 玻璃绘制时用 `GlassSurface.TransformToVisual(Root)` 算出自己在窗口里的矩形，再据此**裁剪 `Snapshot`**（含折射外扩余量）作为效果链输入。
   - 因此「透过玻璃看到的背景」就是白板此刻的真实内容；平移/缩放时 `Snapshot` 连续重绘，玻璃随之连续更新，**无冻结帧/跳变**。

3. **接入到真实白板的建议**：若你的真实白板已用 Win2D/Canvas 绘制，只要「绘制内容的同时，把它画到一张共享 `CanvasRenderTarget`」即可无缝接入；若白板是 XAML 控件树，则需先把该控件渲染到 `RenderTargetBitmap` 或离屏 Win2D 表面（有一次性成本），再交给本渲染器。

---

## 6. 性能与降级说明

**预算（目标 60fps）**：

| 项 | 成本 | 说明 |
|---|---|---|
| 玻璃重绘 | 仅在「动画中 / 背景变化」时发生 | 静止时 `DispatcherQueueTimer` 停止，0 开销 |
| 裁剪 `Snapshot` | 一次小区域 blit | 工具栏高度约 70–90 DIP，很小 |
| 位移贴图 | 256×96 CPU 生成 + 上传 | 逐帧但量级极小；生产可改为 `SetPixelBytes` 复用缓冲 |
| 三通道色散 | 3 次位移 + 3 次色矩阵 + 1 次合成 | 是最大单项开销，**低配直接关** |
| 染色采样 | 4×4 下采样 + 读回 | **仅背景变化时**做一次，非逐帧 |

**降级策略**：

- `LowQuality = true`：关闭三通道色散（单次位移），位移图分辨率减半，仍保留模糊/折射/高光/圆角，观感不塌。
- 更激进（生产可加）：无 `backdrop-filter`/低端设备时退化为「较高不透明度 + 无折射」的稳定玻璃（本 Demo 用 `SaturationEffect` + 固定染色保证即便关折射也清晰可用）。
- 书写态本身已降载（降低高光/染色），也是省电手段之一。

---

## 7. 调试与常见问题

1. **NuGet 版本还原失败**：把 `LiquidGlassDock.csproj` 里 `Microsoft.Graphics.Win2D` 换成本机可用最新稳定版（如 `1.2.x`）；`Microsoft.WindowsAppSDK` 与 `Microsoft.Windows.SDK.BuildTools` 换成 VS 已装的对应版本。

2. **`AppWindow.Resize` 报错/无效**：在 `MainWindow` 构造里调用可能早于窗口就绪。若抛异常，删除该行、改用 `SetWindowSize`/手动拉伸，或在 `Activated` 后调用。

3. **玻璃位置与白板错位（采样偏移）**：确认 `BackdropRoot` 指向白板控件所在的根 `Grid`，且 `Snapshot` 的 DPI 与坐标原点一致（`WhiteboardView.OnDraw` 已按 DIP 尺寸 + DPI 重建快照）。DPI 缩放后若仍错位，检查 `app.manifest` 是否声明了 `PerMonitorV2`。

4. **玻璃模糊但看不到折射**：把 `RefFactor` 调大（0.045→0.09）、`RefThickness` 调大；确认 `LowQuality=false` 且 `Dispersion>0`。

5. **色散出现脏边/重影**：`Dispersion` 只允许极低（0.01 左右）；若背景很花，先加大 `Desaturation` 与 `CenterBlur`。

6. **滑动后不回弹/卡顿**：`SpringDamping` 太小会震荡、太大显生硬；`DispatcherQueueTimer` 只在有运动时运行，确认 `EnsureTimerRunning()` 在按下/移动/松手都被调用。

7. **书写时工具栏没退后**：确认 `Dock.IsWritingProvider` 已接 `Board.IsInking`（本项目已接），且 `WritingDimGlare/WritingDimTint < 1`。

8. **`Matrix5x4` 颜色方向**：若发现「只留红」实际变绿，把 `KeepChannel` 里 `M11/M22/M33` 换成 `M11/M21/M31` 等（即行列互换），本仓库注释已标注约定。

---

## 8. 验收标准对照

| 要求 | 实现 |
|---|---|
| 静态：中心可读、边缘折射/暗化/高光、有厚度 | 中心模糊低 + SDF 边缘折射 + 内侧暗化 + 顶光渐变高光 |
| 滑动：高光跟随、折射随方向变化、回弹自然 | 指针高光弹簧跟随 + 位移图注入 `_slideVelocity` + 欠阻尼弹簧 |
| 画布缩放/平移：背景连续更新 | 离屏快照随视图重绘，`BackdropChanged` 驱动玻璃重采样 |
| 书写：工具栏退后 | `WritingDimGlare/WritingDimTint` 降低高光与染色 |
| 无白边/黑边/锯齿/脏边 | 圆角裁切 + 外扩余量采样 + `BorderMode=Soft` + 低色散 |
| 60fps，低配可降级 | 静止 0 开销 + `LowQuality` 关色散/降分辨率 |
| 不是 blur+opacity+border 冒充 | 位移折射 + 色散 + 去饱和染色 + 镜面高光 + 阴影完整管线 |

---

## 9. 已知限制（诚实披露）

- 本代码**未在交付机编译运行**（该机无 .NET SDK / Visual Studio），按公开 Win2D/WinAppSDK API 逐项编写；少数需按本机 SDK 微调的点已在第 7 节列出。
- 玻璃采样依赖「白板是自有绘制内容」这一前提；若白板是第三方 XAML 树，需先离屏渲染。
- 滑动手势当前绑定在按钮栏的**非按钮区域**（外缘留白 / 按钮间隙），避免与按钮点击抢占指针；指针高光跟随则覆盖整条按钮栏（含按钮上方）。若希望「整条栏都可滑动且不影响点击」，生产需实现点击/拖动阈值判定（按下后位移超过 ~6px 判为滑动并取消按钮点击）。
- 边缘贴靠窗口的工具栏，采样矩形会被裁剪（本 Demo 的居中底栏不会触发）；生产需把「裁剪后的实际来源矩形」回传给 `srcInCrop` 以彻底消除此边界。
- 位移贴图当前逐帧 `CreateFromBytes`（演示级可接受），生产建议 `SetPixelBytes` 复用缓冲。
