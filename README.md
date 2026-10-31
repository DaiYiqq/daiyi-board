# DY Board

DY Board 是一款打开即用的全屏白板。桌面版启动后直接进入纯黑或纯白画布，核心控件收纳在下方工具带；用于展示实物的摄像展台、笔设置和课堂高级工具各自分区，尽量把空间留给板面。

> **最新公开版本：v0.8.0。** [下载 v0.8.0 安装包与签名文件](https://github.com/DaiYiqq/daiyi-board/releases/tag/v0.8.0)。公开源码：[DaiYiqq/daiyi-board](https://github.com/DaiYiqq/daiyi-board)；在线 PWA：[baiboard-hesrkue5.manus.space](https://baiboard-hesrkue5.manus.space)。

## 0.8.0 内置课程表

- **设置内课程表**：设置面板新增课程表，可手动添加/编辑/删除课程（课程名、开始/结束时间、星期），支持 JSON 导入；数据保存在本机。
- **自动识别系统时间**：按「星期几 + 时分」自动匹配当前课程；启动动画下方显示「本节课：xx」，顶部灵动岛放大并显示当前课程，当天课程全部结束后显示「已下课」。

## 0.7.1 原生 Demo 液态玻璃着色器重写

- 原生 `native/winui3-liquid-glass-dock/` 改用真正的 **HLSL 像素着色器**（`LiquidGlassPill.hlsl` / `.cso`）实现边缘折射、RGB 色散与流动镜面高光，抛弃「半透明 + 模糊 + 白边」的毛玻璃卡片观感；底栏改为悬浮胶囊（Pill），每个工具按钮是独立小胶囊（`LiquidGlassPillButton`），支持悬停透镜光斑、按压 Q 弹回弹；新增 `UseShader` 在「着色器 / 内置效果」间 A/B 切换。本项仅改原生参考 Demo，不影响 Electron/PWA 主应用。

## 0.7.0 全局乳白液态玻璃

- **统一全局乳白玻璃**：底栏、按钮、浮层/菜单、弹层、时间胶囊、启动层、全屏时钟/倒计时、展台控件全部统一为**乳白（暖白 #FAF8F5）液态玻璃**——乳白半透明底 + 背景模糊 + 高饱和 + 细边高光，文字/图标改用深色墨水保证可读；不再混用「深色玻璃面板 + 白色玻璃按钮」两套样式。
- **原生 Demo 同步乳白底**：`native/winui3-liquid-glass-dock/` 的玻璃渲染器新增 `GlassBaseOpacity` 乳白底色参数（默认 0.60），观感与网页版一致。

## 0.6.0 原生 WinUI 3 液态玻璃参考实现（已随 v0.7.0 发布）

- 新增 [`native/winui3-liquid-glass-dock/`](native/winui3-liquid-glass-dock/)：一个独立的 WinUI 3 / Windows App SDK + Win2D 白板底部工具栏 Demo，以「真实采样白板背景 + 位移折射 + 三通道色散 + 去饱和染色 + 镜面高光 + 柔和阴影」逼近 Apple Liquid Glass 质感，并支持横向弹性滑动、指针高光跟随、书写态退后与实时调参。
- 这是桌面原生化方向的参考实现，**不影响**现有 Electron/PWA 版本；构建与运行见 [`native/winui3-liquid-glass-dock/README.md`](native/winui3-liquid-glass-dock/README.md)，完整实现说明见 [`native/winui3-liquid-glass-dock/docs/IMPLEMENTATION.md`](native/winui3-liquid-glass-dock/docs/IMPLEMENTATION.md)。

## 0.5.1 液态玻璃透明度与手动保存

- **图片式底部工具栏**：工具集中为下沿居中的横向操作带，图标上置、短标签下置，按课堂工作流分组；当前工具使用绿色描边/图标突出。工具条可横向滚动，窄屏仍可触及完整操作。
- **全局白色液态玻璃控件**：按钮、底栏、展台控件、设置与菜单浮层、提示卡和时钟胶囊采用白色半透明底、背景模糊、细边缘高光和柔和阴影；普通按钮白底不透明度为 0.42，悬停/按压状态为 0.58/0.72，并有低频斜向流光；黑/白主题保持可读性，浏览器不支持模糊时自动回退。

- **5 秒启动页和常驻时间胶囊**：启动时显示“DY Board 正在启动”、倒计时与进度条；随后进入画布。屏幕顶部中央的胶囊每秒刷新本地系统时间。
- **设置归菜单、笔迹归独立框**：主菜单提供设置、帮助、关于/开发者、全屏切换和退出。画笔颜色与粗细放入独立笔设置框，底部工具带保留绘图工具、页面、历史、展台、工程打开/保存及高级入口。
- **安全退出**：Electron 通过受限的 preload/IPC 接口退出桌面程序；浏览器/PWA 不允许网页关掉宿主时，会显示明确说明，用户可关闭当前标签页或窗口。
- **文档摄像展台**：枚举和刷新摄像设备、切换信号源，显示实际输出分辨率和帧率；支持 PNG 拍照、照片栏保存/删除、左右 90°旋转、冻结/继续、镜像、自动/720p/1080p/4K 分辨率请求、显示对比度调节、完整画面适配/铺满及实时批注。设备分辨率取决于摄像头；“清晰度”滑块调整本地画面对比度，不会提升镜头或传感器的光学清晰度。视频与照片只在本机处理，不上传。
- **高级课堂工具**：全屏时钟、课堂倒计时、激光指示器和跟随指针的屏幕局部放大镜；倒计时可调时长、暂停、继续与重置。按 Esc 或“返回白板”离开模式。
- **白板与手动保存**：黑/白空白画布、多色压感笔、橡皮擦、选择/移动/缩放/删除笔迹、多页管理、撤销/重做和 `.daiyi-board.json` 工程导入/导出继续保留。白板页面和笔迹不再自动保存；点击底部“保存”才会保存到本机并下载 JSON 备份。更新不会主动清除既有本机存档；界面偏好仍单独记忆。

## 自动检查与在线升级

- **桌面端自动检查**：已打包版本启动 12 秒后检查更新，运行期间每 6 小时复查；菜单也可手动“检查更新”。无更新时自动检查不打扰。发现新版后显示版本与状态，下载由用户点击，显示进度，下载完成后也只有用户点击“现在重启更新”才会安装/重启。
- **桌面端平台范围**：Windows NSIS 与 Linux AppImage 支持应用内下载和用户确认安装。macOS 与 Linux `.deb` 同样自动检查新版，但因当前 macOS 安装包未配置 Apple Developer ID 签名、`.deb` 更新涉及系统级包安装，检测到新版时引导到 GitHub Release 手动安装，不静默提升权限或替换系统安装包。
- **PWA 更新**：在线版启动时注册并检查新版 Service Worker，之后每 6 小时复查。发现新版后提示“刷新应用”；只有用户点击后才激活新版并重载页面。离线时继续用本地缓存，等待期间旧页面可继续使用；白板页面、偏好设置和工程 JSON 不会因更新被清除。
- **首次过渡**：v0.3.0 及更早的桌面安装包不含更新器；升级者需从 GitHub Release 手动安装当前版本（v0.7.0）一次，之后可使用内置更新。桌面更新清单由 GitHub Release 工作流随安装包生成。

## 获取与安装

- **Windows x64 桌面**：[下载安装向导 `.exe`](https://github.com/DaiYiqq/daiyi-board/releases/download/v0.8.0/DY-Board-0.8.0-win-x64.exe)，含许可说明、安装位置选择、快捷方式、安装后启动与卸载。
- **macOS ARM64 桌面**：[`.dmg`](https://github.com/DaiYiqq/daiyi-board/releases/download/v0.8.0/DY-Board-0.8.0-mac-arm64.dmg) 或 [`.zip`](https://github.com/DaiYiqq/daiyi-board/releases/download/v0.8.0/DY-Board-0.8.0-mac-arm64.zip)。
- **Linux x64 桌面**：[AppImage](https://github.com/DaiYiqq/daiyi-board/releases/download/v0.8.0/DY-Board-0.8.0-linux-x86_64.AppImage) 或 [Debian `.deb`](https://github.com/DaiYiqq/daiyi-board/releases/download/v0.8.0/DY-Board-0.8.0-linux-amd64.deb)。
- **完整 Release 清单**：[`SHA256SUMS`](https://github.com/DaiYiqq/daiyi-board/releases/download/v0.8.0/SHA256SUMS)、[Sigstore bundle](https://github.com/DaiYiqq/daiyi-board/releases/download/v0.8.0/SHA256SUMS.sigstore.json)。
- **浏览器、手机和平板**：通过[在线 PWA](https://baiboard-hesrkue5.manus.space)访问，并按各平台浏览器方式安装/添加到主屏幕。本项目没有单独构建 Android APK 或 iOS IPA。v0.5.1 的 Manus checkpoint 已保存，自动发布已提交；在线版本最终状态以项目 Dashboard 确认为准，确认前线上可能仍是最近一次成功部署的版本。

桌面版已配置的发布目标为 Windows x64、macOS ARM64、Linux x64；其它 CPU 架构以 Release 页面实际产物为准。普通网页不能在没有用户手势时强制隐藏浏览器界面；Electron 启动原生全屏，安装后的 PWA 请求 fullscreen 显示模式。

摄像头仅在用户进入展台后请求授权。Web 摄像 API 需要 HTTPS 或 localhost，并受操作系统隐私授权、浏览器支持和驱动限制。分辨率菜单是理想分辨率请求；如果设备不支持该档位，应用会提示错误并保留原画面。

## 校验与签名

版本发布工作流在 GitHub Actions 构建各平台安装包、生成 `SHA256SUMS`，并使用 GitHub OIDC/Cosign 对清单进行 keyless 签名，同时为构建资产生成 provenance。v0.4.0 的全部 12 个被清单列出的发行文件均已通过 `sha256sum -c SHA256SUMS`；清单签名的 Cosign `verify-blob` 返回 `Verified OK`；Windows x64 安装器、macOS ARM64 DMG 与 Linux x64 AppImage 的 GitHub provenance 均已针对该仓库、发布工作流、`v0.4.0` 标签和源 commit `bc2845fedef66e9980bcbf7b9cce1cbeacfc9e71` 验证成功。v0.5.0 Release 由 workflow run `41073826206` 成功构建并发布，SHA256 清单 12 项、Cosign 签名和三平台代表安装器 provenance 均验证成功，updater metadata 均为 `0.5.0`。v0.5.1 Release 由 workflow run `41160415039` 成功构建并发布到 `v0.5.1`，源 commit 为 `0cfff8021955e1fe616d7ccfacb6d92b21671718`；SHA256 清单 12 项全部通过，Cosign `verify-blob` 返回 `Verified OK`（工作流身份与 GitHub Actions OIDC issuer 匹配）；Windows x64 `.exe`、macOS ARM64 `.dmg`、Linux x64 AppImage 和 Debian `.deb` 的 GitHub provenance 均通过对仓库、`release.yml`、`v0.5.1` 标签及 OIDC issuer 的验证；Windows、macOS、Linux 三份 updater metadata 均报告版本 `0.5.1`。v0.7.0 Release 由 workflow run `41179301246` 成功构建并发布到 `v0.7.0`，源 commit 为 `2bbba790bfb0889b5e2cb49b1629c65742aa088a`；`SHA256SUMS` 清单 12 项、Cosign 签名与三平台 provenance 由同一工作流产出并随 Release 发布。v0.7.1 Release 由 workflow run `41184165911` 成功构建并发布到 `v0.7.1`，源 commit 为 `ee5122a98275920975351be3a8a0056db3e36186`。v0.8.0 Release 由 workflow run `41186842131` 成功构建并发布到 `v0.8.0`，源 commit 为 `1fd94acb4c9374dea783555889b3f9091829026b`。

下载 v0.8.0 Release 附件后，可按以下命令验证清单签名与 Linux AppImage provenance：

```bash
sha256sum -c SHA256SUMS
cosign verify-blob \
  --bundle SHA256SUMS.sigstore.json \
  --certificate-identity-regexp '^https://github\.com/DaiYiqq/daiyi-board/.github/workflows/release\.yml@refs/tags/v0\.8\.0$' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  SHA256SUMS
gh attestation verify DY-Board-0.8.0-linux-x86_64.AppImage \
  --repo DaiYiqq/daiyi-board \
  --signer-workflow DaiYiqq/daiyi-board/.github/workflows/release.yml \
  --source-ref refs/tags/v0.8.0
```

这属于**Release 资产签名**，不代表个人 Git commit 的 GPG/SSH 签名，也不代表 Windows 代码签名证书或 macOS Developer ID/公证。本仓库不含个人私钥或厂商代码签名凭证。

## 本地开发

需要 Node.js 22 和 pnpm 11：

```bash
corepack enable
pnpm install
pnpm dev
```

开发服务器默认在 `http://localhost:3000`。检查和构建：

```bash
pnpm typecheck
pnpm build
```

对应平台安装包命令：

| 平台 | 命令 | 产物 |
| --- | --- | --- |
| Windows | `pnpm desktop:win` | NSIS `.exe` 安装向导 |
| macOS | `pnpm desktop:mac` | `.dmg`、`.zip` |
| Linux | `pnpm desktop:linux` | `.AppImage`、`.deb` |
| 本地运行目录 | `pnpm desktop:pack` | 未安装目录 |

## 项目信息

- 源码、问题反馈与 Release：<https://github.com/DaiYiqq/daiyi-board>
- 许可证：[MIT](LICENSE)
- 贡献方式：[CONTRIBUTING.md](CONTRIBUTING.md)
- 页面路由声明：`public/manus-routes.json`

## 开发者

| 项目 | 信息 |
| --- | --- |
| 开发者 | **戴亿** |
| QQ 邮箱 | [1703205607@qq.com](mailto:1703205607@qq.com) |
| QQ | [1703205607](https://wpa.qq.com/msgrd?v=3&uin=1703205607&site=qq&menu=yes) |
| Gmail | [daiy91004@gmail.com](mailto:daiy91004@gmail.com) |
| 抖音 | **daiyi091004** |
