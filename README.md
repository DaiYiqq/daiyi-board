# DY Board

DY Board 是一款打开即用的全屏白板。桌面版启动后直接进入纯黑或纯白画布，核心控件收纳在下方工具带；用于展示实物的摄像展台、笔设置和课堂高级工具各自分区，尽量把空间留给板面。

> **当前版本：0.3.0，已发布。** [下载 v0.3.0 安装包与签名文件](https://github.com/DaiYiqq/daiyi-board/releases/tag/v0.3.0)。公开源码：[DaiYiqq/daiyi-board](https://github.com/DaiYiqq/daiyi-board)；在线 PWA：[baiboard-hesrkue5.manus.space](https://baiboard-hesrkue5.manus.space)。

## 0.3.0 新增与保留功能

- **5 秒启动页和常驻时间胶囊**：启动时显示“DY Board 正在启动”、倒计时与进度条；随后进入画布。屏幕顶部中央的胶囊每秒刷新本地系统时间。
- **设置归菜单、笔迹归独立框**：主菜单提供设置、帮助、关于/开发者、全屏切换和退出。画笔颜色与粗细放入独立笔设置框，底部工具带保留绘图工具、页面、历史、展台、工程打开/保存及高级入口。
- **安全退出**：Electron 通过受限的 preload/IPC 接口退出桌面程序；浏览器/PWA 不允许网页关掉宿主时，会显示明确说明，用户可关闭当前标签页或窗口。
- **文档摄像展台**：枚举和刷新摄像设备、切换信号源，显示实际输出分辨率和帧率；支持 PNG 拍照、照片栏保存/删除、左右 90°旋转、冻结/继续、镜像、自动/720p/1080p/4K 分辨率请求、显示对比度调节、完整画面适配/铺满及实时批注。设备分辨率取决于摄像头；“清晰度”滑块调整本地画面对比度，不会提升镜头或传感器的光学清晰度。视频与照片只在本机处理，不上传。
- **高级课堂工具**：全屏时钟、课堂倒计时、激光指示器和跟随指针的屏幕局部放大镜；倒计时可调时长、暂停、继续与重置。按 Esc 或“返回白板”离开模式。
- **原有白板能力**：黑/白空白画布、多色压感笔、橡皮擦、选择/移动/缩放/删除笔迹、多页管理、撤销/重做、本地自动保存、`.daiyi-board.json` 工程导入/导出及开发者资料继续保留。既有本地存储键和工程 JSON 格式不变，不会因升级主动清除旧数据。

## 获取与安装

- **Windows x64 桌面**：[下载安装向导 `.exe`](https://github.com/DaiYiqq/daiyi-board/releases/download/v0.3.0/DY-Board-0.3.0-win-x64.exe)，含许可说明、安装位置选择、快捷方式、安装后启动与卸载。
- **macOS ARM64 桌面**：[`.dmg`](https://github.com/DaiYiqq/daiyi-board/releases/download/v0.3.0/DY-Board-0.3.0-mac-arm64.dmg) 或 [`.zip`](https://github.com/DaiYiqq/daiyi-board/releases/download/v0.3.0/DY-Board-0.3.0-mac-arm64.zip)。
- **Linux x64 桌面**：[AppImage](https://github.com/DaiYiqq/daiyi-board/releases/download/v0.3.0/DY-Board-0.3.0-linux-x86_64.AppImage) 或 [Debian `.deb`](https://github.com/DaiYiqq/daiyi-board/releases/download/v0.3.0/DY-Board-0.3.0-linux-amd64.deb)。
- **完整 Release 清单**：[`SHA256SUMS`](https://github.com/DaiYiqq/daiyi-board/releases/download/v0.3.0/SHA256SUMS)、[Sigstore bundle](https://github.com/DaiYiqq/daiyi-board/releases/download/v0.3.0/SHA256SUMS.sigstore.json)。
- **浏览器、手机和平板**：通过[在线 PWA](https://baiboard-hesrkue5.manus.space)访问，并按各平台浏览器方式安装/添加到主屏幕。本项目没有单独构建 Android APK 或 iOS IPA。

桌面版已配置的发布目标为 Windows x64、macOS ARM64、Linux x64；其它 CPU 架构以 Release 页面实际产物为准。普通网页不能在没有用户手势时强制隐藏浏览器界面；Electron 启动原生全屏，安装后的 PWA 请求 fullscreen 显示模式。

摄像头仅在用户进入展台后请求授权。Web 摄像 API 需要 HTTPS 或 localhost，并受操作系统隐私授权、浏览器支持和驱动限制。分辨率菜单是理想分辨率请求；如果设备不支持该档位，应用会提示错误并保留原画面。

## 校验与签名

版本发布工作流在 GitHub Actions 构建各平台安装包、生成 `SHA256SUMS`，并使用 GitHub OIDC/Cosign 对清单进行 keyless 签名，同时为构建资产生成 provenance。v0.3.0 的全部 12 个被清单列出的发行文件均已通过 `sha256sum -c SHA256SUMS`；清单签名的 Cosign `verify-blob` 返回 `Verified OK`；Linux x64 AppImage 的 GitHub provenance 也已针对该仓库、发布工作流、`v0.3.0` 标签和源 commit `19f1bbfff83c524e8ba7910cf0e0ec62038b4c86` 验证成功。

下载 Release 附件后，可按以下示例验证清单签名与 Linux AppImage provenance：

```bash
sha256sum -c SHA256SUMS
cosign verify-blob \
  --bundle SHA256SUMS.sigstore.json \
  --certificate-identity-regexp '^https://github\.com/DaiYiqq/daiyi-board/.github/workflows/release\.yml@refs/tags/v0\.3\.0$' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  SHA256SUMS
gh attestation verify DY-Board-0.3.0-linux-x86_64.AppImage \
  --repo DaiYiqq/daiyi-board \
  --signer-workflow DaiYiqq/daiyi-board/.github/workflows/release.yml \
  --source-ref refs/tags/v0.3.0 \
  --source-digest 19f1bbfff83c524e8ba7910cf0e0ec62038b4c86
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
