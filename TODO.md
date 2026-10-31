# 待办

## 既有白板能力（继续保留）

- [x] **白板页面、画布与撤销重做**：提供多页面白板画布，可新建、切换、清空和管理白板页面，并支持基础撤销与重做。已实现页面新建、切换、清空、重命名、删除与撤销/重做。
- [x] **核心书写、选择与文件恢复**：提供画笔、橡皮擦、选择等核心白板工具；画笔支持多种颜色，并可调整笔触粗细。支持白板内容的选择、移动、缩放与删除；白板工程仅在用户点击“保存”时写入本机并导出 JSON，支持本机旧存档读取和工程文件手动打开，不自动写入新改动。界面偏好仍单独保存在本机。
- [x] **自定义界面与主题**：保留黑/白画布主题、常用工具配置、偏好保存、快捷键与响应式底部工具栏。
- [x] **展台摄像模式基础能力**：自动发现已连接的视频设备、选择设备、实时预览和画面批注；摄像发现和访问受设备/系统授权影响。
- [x] **应用内开发者信息**：展示戴亿、QQ 邮箱 1703205607@qq.com、QQ 1703205607、Gmail daiy91004@gmail.com、抖音 daiyi091004。
- [x] **跨平台安装、开源与签名基础**：公开仓库 `DaiYiqq/daiyi-board`、MIT 许可、README、NSIS 安装引导和 GitHub Actions 跨平台构建/校验/Cosign/provenance 工作流已建立；v0.2.0 三平台版本已成功发布并验证签名。本轮需继续保留。
- [x] **DY Board 品牌及空白板**：全屏打开，去除公开课演示内容；使用 DY Board 名称及中央倾斜 Yi+ 图标。

## DY Board 0.3.0 本轮要求

- [x] **菜单、设置、关于与退出**：软件里加入明确的退出或关闭按钮。把设置、关闭和关于等功能放入主菜单；保留帮助信息。桌面端关闭操作真正退出 Electron 应用，避免用户只能强制结束任务；浏览器/PWA 若宿主阻止脚本关闭，要明确告诉用户如何退出，不谎称已关闭。已添加 Electron 白名单 IPC/退出确认；网页/PWA 显示不能关宿主的退出说明。
- [x] **独立笔设置与主底栏整理**：优化整条底部按钮，保持简洁、最大化画布空间。把笔的颜色、粗细等放在单独的框里；主操作按工具/页面/历史/展台/菜单分组，设置、关闭、关于归入菜单；保留旧白板、页面、撤销重做、工程打开保存、主题和开发者入口。笔色/粗细已移入独立框，其它旧操作仍在底栏；设置、帮助、关于、退出和全屏开关收进菜单。
- [x] **希沃式视频展台控制工作流**：拍照置于底部主要操作位，拍照后在右侧照片栏显示并提供保存；“画面调节”中可向左或向右按 90°旋转；“设置”中选择/切换多摄像设备信号源。还要支持摄像头热插拔刷新、拍照生成可保存 PNG、清晰度/画质显示调节、分辨率选择及显示设备实际输出分辨率、画面冻结/继续、镜像、屏幕适配/铺满选择和实时批注。旋转、横竖比例改变、分辨率和布局调整后画面必须完整适配电脑窗口，批注位置仍与显示的图像对齐。摄像头帧和照片只在本机处理，不上传。上述操作路径参考希沃官方支持页；分辨率/清晰度受摄像头硬件限制，真实设备操作需要硬件环境现场确认。
- [x] **5 秒启动动画与顶部常驻时钟**：软件启动的前 5 秒显示“DY Board 正在启动”，并显示启动倒计时或进度条；随后进入全屏白板。全屏上端有类似手机灵动岛的常驻小胶囊，显示持续更新的系统时间。启动动画、进度条与每秒刷新时钟均已实现。
- [x] **高级功能菜单**：按钮加入“高级功能”选项。必有全屏时钟模式；另提供 2–4 项原创课堂工具。本计划选课堂倒计时、激光指示器、屏幕放大镜三项；它们应从高级功能菜单启用，并可清晰退出回到白板。四种模式可在高级菜单启用，倒计时支持调整/暂停；激光不写入笔迹；放大镜跟随指针。
- [x] **版本升级、检查和 GitHub 发布**：更新应用/安装包版本号至 0.3.0；保留“其他都是老样子”的既有功能和资料。完成类型检查、网页构建、Linux 桌面安装包构建；提交 Manus 主项目并推送用户公开仓库 `DaiYiqq/daiyi-board`，创建 `v0.3.0` 标签，沿用跨平台安装包、SHA256、Cosign 签名与 provenance 发布流程。TypeScript、网页构建、PWA 路由/元数据 smoke check 和 Linux AppImage/DEB 均通过；commit `19f1bbf` 已同步至 Manus canonical 与 GitHub main 并保存为 checkpoint，网站自动发布已提交；GitHub main CI `40892157916` 与 desktop release `40892232044` 均成功。v0.3.0 发布 Windows x64 NSIS `.exe`、macOS ARM64 `.dmg/.zip`、Linux x64 AppImage/DEB；Release 的 12 个 SHA256 条目全部验证通过，Cosign OIDC `verify-blob` 返回 `Verified OK`，GitHub CLI 已针对 `DaiYiqq/daiyi-board/.github/workflows/release.yml`、`refs/tags/v0.3.0` 和源 commit 验证 Linux AppImage provenance 成功。README 已加入实际下载链接和验证命令。个人 GPG/SSH 提交签名、Windows 代码签名证书、macOS Developer ID/公证及未发布架构不在本次交付内。

## DY Board 0.4.0 自动更新与在线升级

- [x] **桌面端自动检查与用户确认升级**：打包的桌面应用在启动后自动检查更新，并在运行期间定期复查；主菜单保留手动“检查更新”入口。检测到新版时明确显示版本和更新状态；Windows 和 Linux AppImage 由用户点击后才下载，显示下载进度，下载完成后由用户点击“现在重启更新”才安装/重启，不在绘图或授课中强制重启。检查中、已是最新版本、检查/下载失败及平台不支持均需有可理解状态。由于当前 macOS 包没有 Apple Developer ID 签名，以及 Linux `.deb` 应由系统包管理器处理，这两种构建检测到新版时都提供 GitHub Release 手动下载/安装入口，不静默替换系统包。已完成代码与 Linux AppImage/DEB 打包验证，生成 GitHub updater 元数据；Windows/macOS 实机更新流程尚未验证。
- [x] **PWA 自动检查与刷新提示**：在线 PWA 启动后检查新版 Service Worker，并在运行期间定期复查；发现新版时显示“新版本可用”，只有用户点击“刷新应用”才激活新版并重新加载，不强制打断正在使用的白板。未确认时当前页面继续可用；断网时保持现有离线缓存行为。更新不得主动清除既有 `localStorage` 白板页面、偏好或导入/导出的工程 JSON 数据。已完成生产构建与路由清单核验；真实浏览器的多版本升级/离线切换尚未实机验证。
- [x] **0.4.0 版本、文档及签名发行**：应用、Electron 安装包、应用内版本号、PWA Service Worker 缓存标识和 README 均同步到 `0.4.0`；GitHub Release 使用 `v0.4.0` 标签，沿用跨平台构建、SHA256 清单、Cosign OIDC 签名和 provenance。Manus 继续作为项目 canonical 主仓，公开镜像保持为 `DaiYiqq/daiyi-board`。既有 v0.3.0 桌面安装包没有 updater，首次升级到 0.4.0 仍需手动安装一次；之后才可使用内置桌面在线更新。v0.4.0 tag 指向构建源 commit `bc2845fedef66e9980bcbf7b9cce1cbeacfc9e71`；GitHub Actions run `41068473985` 三平台构建、Cosign 签名和 provenance 均成功；全部 12 个 checksum 条目验证通过，Cosign 返回 `Verified OK`，Windows x64 安装器、macOS ARM64 DMG 与 Linux x64 AppImage 的 GitHub provenance 均按仓库、workflow、tag 和源 commit 验证成功。Manus canonical 仍为项目主仓，README/TODO 发布文档同步提交为 `6a06cd9`；GitHub `main` 已同步该提交，`v0.4.0` 标签保持指向已验证的构建源。


## DY Board 0.5.0 液态玻璃界面

- [x] **按参考图片重做底部按钮工具栏**：把白板下方按钮调整为参考照片中贴近屏幕下沿、居中横向排列的简洁操作带；每项以图标和短标签表达，按绘图、页面/历史、展台和文件/课堂操作分组，当前绘图工具有明确选中态。保留原有工具的可见配置与拖动排序，并保留笔设置、页面管理、撤销/重做、缩放、展台、打开/保存工程、高级功能和菜单操作。宽屏时工具栏悬浮且紧凑，不占掉白板版面；窗口变窄或在手机上时可横向浏览，遵守安全区，不让按钮覆盖白板内容或变得无法操作。桌面预览计算样式确认底栏居中悬浮、玻璃模糊与标签可见，画笔选中态为绿色；TypeScript 与生产构建通过。
- [x] **让按钮和主要操作面板统一为透明液态玻璃**：按 Apple 手机 UI 的半透明、背景模糊/饱和、细边缘高光和轻悬浮层次处理；不只底栏，也覆盖展台控件、菜单、设置/笔设置面板、提示卡、时钟胶囊和模态控件。黑色及白色画布主题下文字、选中、焦点、禁用及危险状态都保持清晰；支持键盘焦点、触摸尺寸和 `prefers-reduced-motion`，浏览器不支持背景模糊时仍显示清楚可用的半透明样式。展台控件、弹层、时钟和更新卡已统一使用黑白主题玻璃变量；按钮键盘/触摸状态保留，CSS 提供无 backdrop-filter 的可用回退。
- [x] **跨平台版本与公开发行**：不改变现有白板内容、页面/笔迹存储、导入导出 JSON、摄像展台和按钮原有操作；版本更新为 0.5.0，README 同步视觉更新和安装链接。保留 Manus canonical 主项目及 `DaiYiqq/daiyi-board` 公开仓库，完成检查后提交并创建 `v0.5.0`，沿用 Windows/macOS/Linux 构建、SHA256、Cosign OIDC 签名与 provenance 工作流。GitHub Release run `41073826206` 成功；`v0.5.0` 指向构建源 commit `91536530978d8bc71d7aab70c0d885c4bae22bbd`，12 项 SHA256 全部通过，Cosign 返回 `Verified OK`，Windows x64、macOS ARM64 和 Linux x64 资产 provenance 均验证成功，桌面 updater 元数据版本均为 `0.5.0`。Manus checkpoint 与在线 PWA 部署另列如下。

- [ ] **Manus 自动发布完成核验**：将最近的 0.5.1 版本保存到 Manus canonical `main` 并由项目自动发布流程更新在线 PWA。平台已接受 v0.5.1 源 commit `0cfff8021955e1fe616d7ccfacb6d92b21671718` 的 checkpoint 并提交自动发布；Dashboard 最终部署结果尚未通知，未确认前不声明在线已更新。
  - 状态：官方 Git helper 已恢复；canonical 快进推送成功，PWA 类型检查、正式构建和路由清单检查通过。
  - 后续：只在 Dashboard 查看自动发布最终状态；不为同一 checkpoint 重复推送或重复提交发布。


## DY Board 0.5.1 液态玻璃透明度与手动保存

- [x] **按用户视频重新设计按钮材质和反馈**：白板、底部工具栏、展台和主要浮层中的操作按钮使用乳白透明底色；保留背景透色并加强背景模糊/饱和，添加细白边、柔和浮起阴影和内侧厚度高光。参考视频加入低频斜向流光从左向右掠过；悬停时提升亮度与阴影，按下时轻缩到约 0.95。文字/图标用深色保持可读，选中工具使用绿色描边/图标而不是实心色块，色板本身保持原色，减少动态偏好下停止流光。经用户预览反馈，按钮常态白色背景透明度已从 0.68 调整至 0.42，悬停/按下分别为 0.58/0.72；桌面 Preview 的 computed style 确认为 `rgba(255,255,255,0.42)` 且保留 22px 背景模糊。
- [x] **取消白板内容自动保存，只允许手动保存工程**：页面、笔迹、活动页和撤销/重做后的白板工程不再随每次更改自动写入本机；不再以计时器自动清除“未保存”状态。继续读取已有的本机工程存档且不主动清理历史数据。只有用户点击底部“保存”时，才将当前工程明确写入本机存储并下载 `.daiyi-board.json` 备份；本机存储写入成功后清除未保存提示，若写入失败则虽下载 JSON 备份仍保留未保存提示并告知用户。打开工程/绘制/切页后显示未保存状态。独立界面偏好仍留存在本机。类型检查及前端生产构建通过，明确只在用户点击保存时写入白板工程。
- [x] **先提供本地 Preview 等待用户验收**：最初不改变 `0.5.0` 版本号、不提交或推送、不创建 Release；先提供可检查预览。2026-10-31 用户已检查 Preview 并随后明确授权“打包推送至我的github仓库”；现按单独的 0.5.1 发行项继续。
- [x] **0.5.1 包构建与签名公开发行**：将 `package.json`、应用内版本号、Service Worker 缓存代号和 README 同步到 `0.5.1`；通过类型检查、前端构建和本地 Linux 安装包构建。保持 Manus canonical `main` 为主仓，不改变 `DaiYiqq/daiyi-board` 公开镜像；保存 Manus checkpoint 后，将意图明确的同一源 commit 快进推送 GitHub `main` 并创建 `v0.5.1` tag。由既有工作流产出 Windows x64、macOS ARM64、Linux x64 安装包及 GitHub updater metadata、SHA256SUMS、Cosign OIDC 签名和 provenance；发布后验证资产摘要、清单签名和三平台 provenance。不得 force-push 或覆盖既有 tag。Release workflow run `41160415039` 成功；`v0.5.1` 指向源 commit `0cfff8021955e1fe616d7ccfacb6d92b21671718`。SHA256 清单 12 项全通过，Cosign `verify-blob` 为 `Verified OK`；Windows x64 `.exe`、macOS ARM64 `.dmg`、Linux x64 AppImage 和 Debian `.deb` provenance 均验证通过；`latest.yml`、`latest-mac.yml`、`latest-linux.yml` 均为 `0.5.1`。


## DY Board 0.6.0 原生 WinUI 3 液态玻璃参考实现

- [x] **新增 WinUI 3 液态玻璃底部工具栏 Demo**：`native/winui3-liquid-glass-dock/` 提供可运行的 WinUI 3 / Windows App SDK + Win2D 白板底部按钮栏，真实采样白板背景做位移折射/色散/去饱和染色/镜面高光，支持横向弹性滑动、指针高光跟随、书写态退后与实时调参。仅作参考实现，不改动 Electron/PWA 主应用。
- [x] **版本号同步 0.6.0**：`package.json`、`src/App.tsx` 的 `APP_VERSION`、`public/sw.js` 缓存代号同步为 0.6.0（源码开发中版本，未打 tag、未发布 Release）。
- [ ] **（可选）0.6.0 打包与签名发行**：如后续需要，创建 `v0.6.0` tag，沿用跨平台构建、SHA256、Cosign OIDC 签名与 provenance 工作流。


## DY Board 0.7.0 全局乳白液态玻璃

- [x] **统一全局乳白玻璃**：`src/style.css` 与 `src/components/CameraStage.css` 将底栏、按钮、浮层/菜单、弹层、时间胶囊、启动层、全屏时钟/倒计时、展台控件统一为乳白（暖白 #FAF8F5）液态玻璃 + 深色墨水，消除「深色玻璃面板 + 白色玻璃按钮」两套混用。
- [x] **原生 Demo 同步乳白底**：`native/winui3-liquid-glass-dock/` 渲染器新增 `GlassBaseOpacity` 乳白底色参数（默认 0.60），并同步调参面板。
- [x] **版本号同步 0.7.0**：`package.json`、`src/App.tsx` 的 `APP_VERSION`、`public/sw.js` 缓存代号同步为 0.7.0（源码开发中版本，未打 tag、未发布 Release）。
- [x] **0.7.0 打包与签名发行**：已创建 `v0.7.0` tag 并推送，GitHub Actions release workflow run `41179301246` 三平台构建成功并发布 Release；`SHA256SUMS` 12 项、Cosign 签名与 provenance 随 Release 产出。


## DY Board 0.7.1 原生 Demo 液态玻璃着色器重写

- [x] **HLSL 像素着色器**：`native/winui3-liquid-glass-dock/` 新增 `Shaders/LiquidGlassPill.hlsl`（fxc 编译为 `.cso`，已随仓库提交）实现边缘折射、RGB 色散、流动镜面高光；`LiquidGlassShaderEffect.cs` 封装 Win2D `PixelShaderEffect`。
- [x] **胶囊按钮与 A/B 切换**：`GlassDock` 的工具按钮全部换成 `LiquidGlassPillButton` 独立小胶囊；新增 `UseShader` 参数与调参开关，可在「HLSL 着色器 / 内置效果」间切换。本项仅改原生 Demo，不影响 Electron/PWA 主应用。
- [x] **版本号同步 0.7.1**：`package.json`、`src/App.tsx` 的 `APP_VERSION`、`public/sw.js` 缓存代号同步为 0.7.1。
- [x] **0.7.1 打包与签名发行**：已创建 `v0.7.1` tag 并推送，GitHub Actions release workflow run `41184165911` 三平台构建成功并发布 Release；`SHA256SUMS`、Cosign 签名与 provenance 随 Release 产出。


## DY Board 0.8.0 内置课程表

- [x] **设置内课程表**：设置面板新增课程表，可手动添加/编辑/删除课程（课程名、开始/结束时间、星期），支持 JSON 导入，数据存本机 `localStorage`。
- [x] **自动识别系统时间**：按「星期几 + 时分」自动匹配当前课程；启动动画下方显示「本节课：xx」；灵动岛放大，上课中显示当前课程名，当天课程结束后显示「已下课」。
- [x] **版本号同步 0.8.0**：`package.json`、`src/App.tsx` 的 `APP_VERSION`、`public/sw.js` 缓存代号同步为 0.8.0。
- [x] **0.8.0 打包与签名发行**：已创建 `v0.8.0` tag 并推送，GitHub Actions release workflow run `41186842131` 三平台构建成功并发布 Release；`SHA256SUMS`、Cosign 签名与 provenance 随 Release 产出。


## DY Board 0.9.0 课程表网格化（单双周 + 节次）

- [x] **网格课表**：课程表从列表升级为「节次 1–9 × 周一~周日」网格，支持单双周两套课表；网格编辑器支持点击单元格编辑、快速填充、每节起止时间编辑与保存校验。
- [x] **实时状态**：按系统时间识别单/双周与当前节次，区分「上课中 / 休息中 / 已下课 / 无课」并提示距离下节课分钟数；启动页与灵动岛同步显示。
- [x] **版本号同步 0.9.0**：`package.json`、`src/App.tsx` 的 `APP_VERSION`、`public/sw.js` 缓存代号同步为 0.9.0。
- [x] **0.9.0 打包与签名发行**：已创建 `v0.9.0` tag 并推送，GitHub Actions release workflow run `41190431106` 三平台构建成功并发布 Release；`SHA256SUMS`、Cosign 签名与 provenance 随 Release 产出。


## DY Board 1.0.0 教学工具与地理地图

- [x] **教学工具（地理地图）**：高级菜单新增「教学工具」，内置「地理地图」——基于高德地图（AMap，含 Key 与安全密钥），支持全屏查看与返回白板。
- [x] **界面修复**：玻璃表面作用域内统一浅色控件面/边框，修复课程表编辑器「黑字黑框」对比度问题。
- [x] **版本号同步 1.0.0**：`package.json`、`src/App.tsx` 的 `APP_VERSION`、`public/sw.js` 缓存代号同步为 1.0.0。
- [x] **1.0.0 打包与签名发行**：已创建 `v1.0.0` tag 并推送，GitHub Actions release workflow run `41192853827` 三平台构建成功并发布 Release；`SHA256SUMS`、Cosign 签名与 provenance 随 Release 产出。
