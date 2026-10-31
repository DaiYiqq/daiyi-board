# DY Board — WinUI 3 液态玻璃底部工具栏 Demo

一个**可运行**的 Windows 11 白板底部按钮栏 Demo：用 **WinUI 3 / Windows App SDK + Win2D** 实现接近 Apple Liquid Glass 质感的**透明液态玻璃**工具栏——不是「半透明 + 模糊 + 白边框」。

- 玻璃**真实采样按钮栏背后的白板内容**（墨迹 / 便签 / 形状），拖动、缩放画布时透过玻璃看到的背景实时更新。
- 玻璃具备：**中心通透 / 边缘折射 / 克制色散 / 去饱和染色 / 镜面高光 / 边缘暗化 / 连续圆角 / 柔和阴影**。
- **横向滑动**：按钮栏弹性偏移、回弹，折射方向随滑动拉伸，镜面高光**跟随指针**流动。
- **书写态**：书写时玻璃自动「退后」（压低高光与染色）。
- 所有可调参数集中在 `LiquidGlassParameters`，并配有一个实时调参面板。

> 说明：这是针对 `daiyi-board`（Electron/React）未来原生化、或作为独立参考实现的原生 Demo。
> 它与你现有仓库 `DaiYiqq/daiyi-board` 的 Web 版是**两套独立代码**，互不影响。

---

## 1. 运行环境

- Windows 11（Windows 10 1809+ 也可）
- Visual Studio 2022 / 2026，勾选「.NET 桌面开发」与「Windows 应用程序开发」（Windows App SDK 工作负载）
- .NET 8 SDK（`dotnet --version` ≥ 8.0）
- 首次还原会自动拉取 NuGet 包：`Microsoft.WindowsAppSDK`、`Microsoft.Windows.SDK.BuildTools`、`Microsoft.Graphics.Win2D`

## 2. 构建与运行

方式一（命令行，非打包）：

```powershell
dotnet run --project src\LiquidGlassDock
```

方式二（Visual Studio）：直接打开 `src\LiquidGlassDock\LiquidGlassDock.csproj`，选择 `x64` 平台后按 F5。

> 首次构建需要联网还原 NuGet；若 `Microsoft.Graphics.Win2D` 版本还原失败，请把它换成当前可用的最新稳定版（见 `LiquidGlassDock.csproj`）。

## 3. 操作

| 操作 | 效果 |
|---|---|
| 左键在画布拖动 | 画笔书写（书写时工具栏退后） |
| 右键 / 中键拖动 | 平移画布（透过玻璃的背景实时更新） |
| 滚轮 | 以指针为锚缩放画布 |
| 在工具栏上横向拖动 | 玻璃弹性滑动 + 回弹，高光跟随指针，折射随方向拉伸 |
| 点工具栏按钮 | 选择 / 画笔 / 橡皮 / 便签 / 形状 / 文字 |
| 右上角齿轮 | 打开 / 关闭液态玻璃参数面板 |

## 4. 项目结构

```
src/LiquidGlassDock/
├─ App.xaml(.cs)                    应用入口
├─ MainWindow.xaml(.cs)             白板 + 玻璃工具栏 + 参数面板的组装与接线
├─ LiquidGlassDock.csproj           WinUI 3 / WinAppSDK + Win2D 项目
├─ app.manifest                     PerMonitorV2 DPI 感知
├─ Controls/
│  ├─ WhiteboardView.xaml(.cs)      白板画布：渲染到屏幕 + 离屏快照，平移/缩放/书写
│  ├─ GlassDock.xaml(.cs)           底部玻璃工具栏：指针交互 + 弹簧物理 + 玻璃绘制
│  └─ SettingsPanel.xaml(.cs)       参数调参面板（双向绑定 LiquidGlassParameters）
├─ Glass/
│  ├─ LiquidGlassParameters.cs      全部可调参数（INotifyPropertyChanged）
│  ├─ LiquidGlassEffectRenderer.cs  效果管线：模糊→折射→色散→去饱和→染色→高光→阴影
│  └─ GlassSpring.cs                欠阻尼弹簧积分器（回弹 / 高光跟随）
└─ Whiteboard/
   └─ WhiteboardScene.cs            白板内容模型（墨迹/便签/形状）+ 纯绘制
```

## 5. 一句话结论（完整分析见 `docs/IMPLEMENTATION.md`）

- **方案 A（LiquidGlassWinUI 的 `LiquidGlassBrush`）**：现成、参数风格吻合，但它采样的是**桌面背景**而非应用内白板内容，且没有「指针位置高光中心 / 滑动方向折射拉伸」的动态入口，无法满足本需求的核心交互。
- **方案 B（Win2D + Composition 自行构建，本 Demo 采用）**：把白板渲染到一张**离屏快照**，玻璃按自己的矩形**真实裁剪采样**这张快照，再跑「模糊→位移折射→色散→去饱和→染色→高光」管线。唯一能同时满足「真实采样白板 + 滑动折射 + 高光跟随」的方案。

**诚实限制**：WinUI 3 的 `CompositionBackdropBrush`（Mica/Acrylic 的底层）只能采样系统提供的窗口背景/壁纸，**无法采样同一窗口里某元素背后的任意应用内容**。因此「采样按钮栏背后白板」必须靠本 Demo 的「离屏快照」方式实现——这也是它能成立的根因：白板是你自己的绘制内容，你可以把它同时画到一张纹理上供玻璃采样。

## 6. 关于「无法在本机编译验证」的说明

交付环境没有安装 .NET SDK 与 Visual Studio（已核查），因此本代码**未在本机实际编译运行**，只按 Win2D / Windows App SDK 公开 API 逐项对照编写。绝大多数 API（`CanvasControl`、`GaussianBlurEffect`、`DisplacementMapEffect`、`TurbulenceEffect`、`SaturationEffect`、`CompositeEffect`、`ColorMatrixEffect`、`CanvasBitmap.CreateFromBytes` 等）都是长期稳定接口；少数（NuGet 精确版本、渐变刷属性名、`AppWindow.Resize` 时机）可能需按本机 SDK 微调，具体见 `docs/IMPLEMENTATION.md` 第 7 节「常见问题」。
