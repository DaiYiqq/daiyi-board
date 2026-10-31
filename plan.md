# DY Board 0.3.0 改版计划

## 产品实现

沿用现有 React + TypeScript + Vite + Electron 应用，不重置白板数据、不更换 JSON 工程格式，也不移除 v0.2.0 的画布、笔迹、页面、摄像权限、本地自动保存、开发者资料、开源授权或发布签名能力。版本升至 0.3.0，推送变更到 Manus 主分支和公开 GitHub `DaiYiqq/daiyi-board`，打 `v0.3.0` 标签继续使用跨平台构建、校验与 Sigstore 签名工作流。

桌面端主菜单中提供菜单、设置、关于/帮助、退出程序；退出由安全的 Electron preload/IPC 桥接调用 `app.quit()`，普通浏览器和 PWA 使用明确提示而不假称网页能强关宿主。笔颜色与粗细集中在独立的“笔设置”浮框。底部仍是主要操作区，并按熟悉的课堂工作流整理页面、文件、画笔/选择/橡皮、撤销重做、摄像展台、高级功能和菜单。

启动时显示 5 秒 DY Board 启动覆盖层，展示启动字样、倒数及进度条，结束后直接回到无装饰空白板。全屏顶部中央新增固定胶囊时钟，按本地系统时钟每秒更新。高级功能包括全屏时钟、课堂倒计时、激光指示器和屏幕放大镜；用户可以退出覆盖层/模式回到白板。

将摄像展台移至独立的 `src/components/CameraStage.tsx`：枚举与热插拔刷新设备、选择信号源；按用户选择向 `getUserMedia` 请求分辨率/帧率，并报告设备实际输出分辨率；提供画质显示调节、原始比例适配/铺满、冻结/继续、镜像、左右旋转 90°、拍照和批注。拍照保留调整后的方向、画质与当前批注，保存为 PNG；已拍照片显示在右侧缩略图栏，可分别保存。使用视频原始宽高、旋转后纵横比、舞台尺寸和适配模式计算有效显示框，使图像完整显示且批注指针与画面一致。保留本地摄像处理，不上传画面或照片。

公开的希沃帮助资料所示基本操作路径为“底部工具栏拍照、右侧照片栏保存；画面调节选择旋转并按 90°旋转；设置中选择信号源”（参考：[官方产品页](https://www.seewo.com/product/strategy/spzt)、[官方支持页](https://www.seewo.com/product/support/spzt)）。此实现参考这些通用工作流和用户列出的需求，不复制希沃品牌资产或像素级界面。

## 设计语言

- **Design Movement**：DY Board 既有的极简黑白教学工作台，借用直观的展台控制层级，而不是仿制其他软件的品牌视觉。
- **Core Principles**：白板和相机画面优先；控制按任务分区；必要功能单击可达；转屏/分辨率改变后画面与批注保持对齐。
- **Color Philosophy**：黑/白画布仍为主；中性深浅工具面板；少量青蓝只标识选择/激活状态，拍照/退出等危险或主要操作使用清晰语义色。
- **Layout Paradigm**：中央最大化显示画布/展台；下方为横向主工具带；笔设置与菜单为靠近触发按钮的独立浮框；拍摄后照片缩略图靠右；顶边中央胶囊提供常驻时间。
- **Signature Elements**：DY Board 倾斜 Yi+；顶部小型时间胶囊；底栏上的拍照快门和照片胶卷入口。
- **Interaction Philosophy**：展台遵循“选择信号源—调画面—拍照—在照片栏保存”路径。分辨率显示请求档与设备实际档；失败后保留正在播放的旧流，不留空白预览。退出确认需防止误关。
- **Animation**：启动动画仅播放前 5 秒，进度平滑推进，不阻塞画布数据恢复；面板和工具状态使用短促淡入/位移，尊重 `prefers-reduced-motion`。
- **Typography System**：系统无衬线字体；时间数字采用等宽数字；按钮以简短动词和清晰图标为主。
- **Brand Essence**：打开就能演示与书写的课堂白板；直接、可靠、克制。
- **Brand Voice**：状态说明简洁可执行。例如「DY Board 正在启动」「已拍摄，保存到本机」。
- **Wordmark & Logo**：延续深色圆角底与倾斜 Yi+，不另造供应商标识。
- **Signature Brand Color**：黑白为底，青蓝为操作焦点色。

## 项目结构

- `src/App.tsx`：既有白板和页面状态、工具带、主菜单、画笔设置、启动层、系统时钟及高级功能模式。
- `src/components/CameraStage.tsx`：独立摄像流、适配几何、图像设置、截图、右侧照片保存栏与实时批注。
- `src/App.tsx` 中的高级模式状态和浮层：全屏时钟、倒计时、激光指针和局部放大交互；与白板绘制事件分开处理。
- `src/style.css`：黑/白画布、菜单/笔设置浮框、时钟胶囊、启动层、展台自适应视频舞台、快照栏和移动/桌面断点。
- `electron/main.cjs` 与 `electron/preload.cjs`：仅暴露受限退出接口并校验请求来源。
- `package.json`、`README.md`、`TODO.md`：版本与下载说明、开发者信息、旧需求保留及本次功能记录。
- `.github/workflows/`：复用现有 CI、三平台发行、SHA256、Cosign OIDC 与 provenance 工作流。

## DY Board 0.4.0 自动更新与在线升级计划

沿用 0.3.0 的极简黑白界面与 Yi+ 品牌，将应用版本推进到 0.4.0。保留现有本地白板自动保存、工程 JSON 兼容、相机图片本地化处理和全部课堂工具；升级不得清除旧版本用户数据。

- **桌面更新**：将 `electron-updater` 加入运行时依赖，`package.json` 为 GitHub 发布仓库 `DaiYiqq/daiyi-board` 声明 updater 发布源，以生成并随 release 发布 Electron 更新清单。`electron/main.cjs` 在打包版本启动后自动检查更新、定期复查，并提供受信任 IPC 请求；`electron/preload.cjs` 仅暴露检查、下载、安装/重启、状态订阅和打开 Release 页面所需 API。`src/App.tsx` 主菜单提供手动“检查更新”，新版本通知、下载进度与等待重启安装均由用户明确操作；不在白板绘制中途强制下载或重启。Windows 和 Linux AppImage 支持应用内下载/安装；当前 macOS 包未配置 Apple Developer ID 签名，检测到新版本后引导用户到 GitHub Release 手动安装；Linux `.deb` 可自动检查，但新版仅引导用户从 Release 手动更新，不替换系统包。
- **PWA 更新**：`src/main.tsx` 注册时关闭 `sw.js` HTTP 缓存并检查新 Service Worker；应用启动以及其后定期请求更新。`public/sw.js` 缓存名随版本变化；已有控制器时让新版 Service Worker 暂停等待，页面通过同一更新提示告知用户，只有用户点击“刷新应用”才跳过等待、接管页面并重新加载。首次安装仍可直接激活。更新不删除 `localStorage` 中的白板与设置，不改变工程 JSON；离线时继续使用现有缓存。
- **用户界面与提示**：沿用黑/白主题、青蓝焦点色和低干扰浮层。在桌面/PWA 新版就绪时显示版本、明确的“下载更新”“现在重启更新”或“刷新应用”按钮；“检查更新”需显示检查中、已是最新版本、下载进度/失败和 Linux `.deb` 手动更新说明。自动启动检查在没有更新时保持安静。
- **资料和一次性迁移说明**：本计划阶段曾将 `APP_VERSION`、Service Worker 缓存标识、`package.json` 和 `README.md` 升至 0.4.0，并保持 Release 签名与 provenance 工作流。v0.3.0 及更早的既有桌面安装包没有 updater 代码；当前版本为 0.5.0，用户可直接手动安装当前版本一次，之后由内置更新器获取后续版本。Manus 仍为项目 canonical 主仓，GitHub `DaiYiqq/daiyi-board` 保持公开发行镜像。

项目结构补充：`src/main.tsx` 管理 PWA Service Worker 注册、更新检测及安全激活；`public/sw.js` 管理带版本号的离线缓存与等待/激活；`electron/main.cjs` 和 `electron/preload.cjs` 实现桌面更新检查、下载、状态 IPC 和安装；`src/App.tsx` 与 `src/style.css` 提供统一更新入口和非打断式提示；`package.json` 声明 GitHub updater provider 与应用版本，现有 `.github/workflows/release.yml` 继续构建跨平台安装包、SHA256、Cosign 签名和 provenance。

## 0.4.0 运行边界

桌面在线更新依赖可访问 GitHub Releases；macOS 安装包未使用 Apple Developer ID 签名，因此仅提供新版检测与 Release 手动安装指引；Electron AppImage 更新能力仅适用于 AppImage 启动的 Linux 发行包，Linux `.deb` 由系统包管理/用户手动安装。PWA 必须在线检查到新版 Service Worker 才可提示；用户未确认时旧页面继续工作。0.3.0 既有桌面应用尚无 updater 代码，无法通过 0.4.0 反向注入更新器，需一次手动安装过渡。

## 运行限制

相机可用分辨率由摄像设备、操作系统和浏览器决定；应用请求理想分辨率并显示实际输出，不能凭软件提升传感器本身的光学清晰度。“清晰度”控件只改变本地预览/导出图的图像对比显示处理。Electron 可真正退出桌面进程；浏览器页不能强行关闭由用户开启的标签。Windows ARM64/macOS Intel 的包是否发布由现有 workflow 目标与 runner 实际产物决定。


## DY Board 0.5.0 底部工具栏与液态玻璃

沿用 React、TypeScript、Vite、Electron 和 PWA 架构；将图片中投影白板下沿的紧凑横向操作带作为布局参考：绘图和课堂操作按组横排，图标配简短文字，当前绘图工具以绿色状态突出，主画布继续占据绝大部分屏幕。工具顺序、用户的可见工具偏好、拖动排序和现有绘图/页面/文件/展台/历史/高级/菜单行为均保留；桌面端使用居中的浮动工具胶囊，宽度受视口限制时可横向滚动，手机和小窗口兼容安全区，不遮挡或缩小可用白板区域。

采用原生 Web CSS `backdrop-filter`、高饱和背景采样、淡色调、内侧高光、柔和边缘和轻微悬浮阴影，统一应用于主工具栏、展台工具栏、所有交互按钮、菜单与设置浮层、提示卡片、时钟胶囊及模态面板。黑白画布主题各自选取足够不透明的玻璃底色与文字颜色，活动工具沿用参考图片中的绿色强调；键盘焦点、禁用/危险操作、触摸尺寸和减少动态效果偏好保持可识别。`backdrop-filter` 不受支持时退化为稳定的不透明度较高的半透明底色，确保 Electron、现代浏览器、PWA 和低性能设备仍可用。

用户提供的参考链接 `https://github.com/pratikone/liquid-glass-WinUI` 是 WinUI 3/Win2D 原生演示，使用实时背景取样与 blur/turbulence/displacement/tint/blend 效果链。该工程的 C#/Win2D GPU 实现不直接移植；DY Board 使用 CSS 近似模糊、饱和与高光，不引入 Windows 专属依赖或把工具条重效果渲染叠加到白板画布上。完成后将应用版本升至 0.5.0，README/待办同步视觉变化，在 Manus 保持 canonical 的前提下提交 GitHub 公开仓库与签名 Release。


## 用户视频参考的按钮材质与手动保存预览（未发布）

用户于 2026-10-31 提供本地视频 `SVID_20261031_094613_1.mp4`，分析显示按钮为乳白半透明面（约 0.4–0.6 alpha）、20px 左右背景模糊与饱和、细白边缘高光、柔和 5–10px 悬浮阴影、斜向白色流光由左至右扫过；交互含 hover 增亮/扩散阴影与按下缩至约 0.95。此次预览把这些视觉用于白板、展台和主要弹层中的非色板按钮，底色统一为白色透明、深灰图标/文字，选中态保留绿色描边/图标提示，不用实心绿色/蓝色覆盖玻璃底色；流光克制且支持 `prefers-reduced-motion`，无 `backdrop-filter` 时仍有足够清晰的白玻璃底。

关闭白板工程 pages/activePage 的自动写入与定时清除 dirty 的计时器；保留旧 `localStorage` 数据读取，不升级时清空任何数据。用户点击“手动保存”时才将当前工程写入本机 `STORAGE_KEY` 并下载 `.daiyi-board.json`，显示未保存/已保存状态。个人界面偏好（主题、紧凑模式和工具可见性）仍沿用其独立本机偏好存储。该改动最初仅做本地 Preview；2026-10-31 用户确认效果后授权打包并推送 GitHub，Preview-only 限制现已由该新授权取代。

## DY Board 0.5.1 打包与发行

将 `package.json`、应用关于/更新提示中的 `APP_VERSION` 与 Service Worker 缓存代号同步为 0.5.1；README 在正式资产可用后更新到 v0.5.1。保留既有 0.5.0 tag 和完整 Git 历史。先在 Manus canonical `main` 集成并保存本次意图明确的源文件，按项目已启用的 auto-publish 保存 checkpoint；再将相同源 commit 与 `v0.5.1` tag 快进同步至用户指定的公开仓库 `DaiYiqq/daiyi-board`，由现有 GitHub Actions 为 Windows、macOS 和 Linux 构建安装包、SHA256 清单、Cosign OIDC 签名和 provenance。任何一端非快进时停止并保留双方历史；不切换 Manus canonical 到 GitHub、不 force-push。


## DY Board 0.6.0 原生 WinUI 3 液态玻璃参考实现（开发中）

新增 `native/winui3-liquid-glass-dock/` 独立 WinUI 3 / Windows App SDK + Win2D 参考项目：用「白板离屏快照 + 位移折射 + 三通道色散 + 去饱和染色 + 镜面高光 + 柔和阴影」实现接近 Apple Liquid Glass 的底部工具栏，支持横向弹性滑动、指针高光跟随、书写态退后与实时调参。该 Demo 不影响现有 Electron/PWA 主应用，不改变 Web 端产物；版本号同步至 0.6.0（仅源码，未打 tag、未构建安装包、未发布 Release）。


## DY Board 0.7.0 全局乳白液态玻璃

将网页版 `src/style.css` 与展台 `src/components/CameraStage.css` 的玻璃样式统一为**乳白（暖白 #FAF8F5）液态玻璃**：底栏、按钮、浮层/菜单、弹层、时间胶囊、启动层、全屏时钟/倒计时与展台控件全部乳白半透明底 + 背景模糊 + 高饱和 + 细边高光，文字/图标改用深色墨水；去掉「深色玻璃面板 + 白色玻璃按钮」两套混用。原生 Demo 同步新增 `GlassBaseOpacity` 乳白底色参数。版本号同步至 0.7.0；已创建 `v0.7.0` tag 并由 release workflow run `41179301246` 发布三平台安装包、`SHA256SUMS`、Cosign 签名与 provenance。


## DY Board 0.7.1 原生 Demo 液态玻璃着色器重写

原生 `native/winui3-liquid-glass-dock/` 改用 HLSL 像素着色器（`LiquidGlassPill.hlsl` 经 fxc 编译为 `.cso`，随仓库提交）实现边缘折射、RGB 色散与流动镜面高光；底栏改为悬浮胶囊，工具按钮换成 `LiquidGlassPillButton` 独立小胶囊，支持悬停光斑、按压回弹与 `UseShader` A/B 切换。本项仅改原生参考 Demo，不影响 Electron/PWA 主应用；版本号同步至 0.7.1。
