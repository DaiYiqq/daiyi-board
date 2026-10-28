# DY Board

DY Board 是一个优先留出书写空间的全屏白板。启动后直接进入纯黑或纯白画布，主要操作集中在屏幕底边；不再显示公开课样例或演示文案。它保留多色笔迹、页面、撤销重做、摄像展台、本地工程和开发者信息。

> 当前版本 **0.2.0** 已正式发布。公开源码：[DaiYiqq/daiyi-board](https://github.com/DaiYiqq/daiyi-board)；[v0.2.0 Release 下载页](https://github.com/DaiYiqq/daiyi-board/releases/tag/v0.2.0)；[在线安装版 PWA](https://baiboard-hesrkue5.manus.space)。
## 主要功能

- **全屏空白画布**：Electron 桌面版启动即原生全屏；已安装 PWA 优先请求全屏显示。深色主题显示纯黑板，明亮主题显示纯白板。普通浏览器受安全限制，网页不能在未获用户手势时强制隐藏浏览器界面，但应用画面始终铺满可视区域。
- **简洁底部工具栏**：画笔、选择、橡皮、多色选择、自定义颜色、笔触粗细、页面管理、撤销/重做、缩放、摄像展台、打开/保存工程、黑白主题和设置均放在底部。可在设置中显隐常用工具、开启紧凑布局，并拖动调整绘图工具顺序。
- **书写与编辑**：支持指针/触屏、兼容设备压感；笔迹可选择、移动、等比缩放和删除；支持 Ctrl/⌘+Z 撤销、Ctrl/⌘+Y 重做。
- **页面与本地工程**：可新建、切换、重命名、清空和删除页面；自动保存到当前浏览器/Electron 用户配置文件，可导入或导出 `.daiyi-board.json` 工程。数据留在本地，不上传；升级不会主动清除既有白板数据，旧工程格式与本地存储键保持兼容。
- **摄像展台**：识别已连接的视频输入设备，允许选择/切换摄像头，在实物画面上做彩色批注；视频和批注在本地处理。设备发现和访问取决于浏览器 API、HTTPS/localhost、安全权限、系统授权及驱动。
- **开发者资料**：应用内“关于”及本 README 均列出完整联系方式。

## 获取与安装

v0.2.0 当前发布的桌面安装包如下：

| 平台 | 安装包 | 架构 |
| --- | --- | --- |
| Windows | [NSIS 安装向导 `.exe`](https://github.com/DaiYiqq/daiyi-board/releases/download/v0.2.0/DY-Board-0.2.0-win-x64.exe) | x64 |
| macOS | [DMG 安装包](https://github.com/DaiYiqq/daiyi-board/releases/download/v0.2.0/DY-Board-0.2.0-mac-arm64.dmg) · [ZIP](https://github.com/DaiYiqq/daiyi-board/releases/download/v0.2.0/DY-Board-0.2.0-mac-arm64.zip) | Apple Silicon ARM64 |
| Linux | [Debian `.deb`](https://github.com/DaiYiqq/daiyi-board/releases/download/v0.2.0/DY-Board-0.2.0-linux-amd64.deb) · [AppImage](https://github.com/DaiYiqq/daiyi-board/releases/download/v0.2.0/DY-Board-0.2.0-linux-x86_64.AppImage) | x64 / amd64 |

浏览器与手机/平板可使用[在线 PWA](https://baiboard-hesrkue5.manus.space)，并按各平台浏览器的方式安装或添加到主屏幕。本版本没有单独生成 Android APK 或 iOS IPA。上述桌面包仅覆盖表格列出的 CPU 架构；其他架构可从源码自行构建。

桌面 NSIS 安装向导提供许可协议、安装位置选择、开始菜单/桌面快捷方式、安装完成启动应用及标准卸载入口；包元数据列出开发者“戴亿”。默认工作流使用 GitHub OIDC/Cosign 对 SHA256 清单进行 keyless 签名，并为安装资产生成 GitHub provenance。它不等同于开发者个人 GPG/SSH 提交签名或 Windows/macOS 厂商代码签名；本仓库不含个人私钥、Windows 代码签名证书或 macOS Developer ID/公证凭证。

### 发布资产验证

在 Release 下载 SHA256 清单、`SHA256SUMS.sigstore.json` bundle 和对应安装包后，可运行：

```bash
sha256sum -c SHA256SUMS
cosign verify-blob \
  --bundle SHA256SUMS.sigstore.json \
  --certificate-identity-regexp '^https://github.com/DaiYiqq/daiyi-board/.github/workflows/release.yml@refs/tags/v0\.2\.0$' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  SHA256SUMS

gh attestation verify DY-Board-0.2.0-linux-x86_64.AppImage \
  --repo DaiYiqq/daiyi-board \
  --signer-workflow github.com/DaiYiqq/daiyi-board/.github/workflows/release.yml \
  --source-ref refs/tags/v0.2.0 \
  --source-digest a88bdd72ad7029f3bb195dd5ce4db2df3d8439e6
```

GitHub Actions 的 v0.2.0 三平台构建已通过；发布包含 12 项可校验资产。已实际验证 SHA256 清单的 GitHub OIDC/Cosign 签名、全部清单哈希，以及限定 v0.2.0 标签与 commit 的 Linux AppImage provenance。GitHub Actions 对后续 `v*` 标签继续运行 Windows/macOS/Linux 构建。

## 本地开发

需要 Node.js 22 和 pnpm 11：

```bash
corepack enable
pnpm install
pnpm dev
```

开发服务器默认在 `http://localhost:3000`。运行检查和构建：

```bash
pnpm typecheck
pnpm build
```

在对应平台构建安装包：

| 平台 | 命令 | 产物 |
| --- | --- | --- |
| Windows | `pnpm desktop:win` | NSIS `.exe` 安装向导 |
| macOS | `pnpm desktop:mac` | `.dmg`、`.zip` |
| Linux | `pnpm desktop:linux` | `.AppImage`、`.deb` |
| 未安装目录预览 | `pnpm desktop:pack` | 可运行目录 |

摄像头首次访问需要授予操作系统/浏览器权限；非 localhost 的 Web 环境需要 HTTPS。请在清除浏览器站点数据或卸载前导出重要工程。

## 工程结构

```text
src/                    React/TypeScript 白板界面、交互与样式
public/                 PWA 清单、离线缓存、路由清单和 Yi+ 图标
electron/               原生全屏桌面主进程与受限 preload
build/                  Electron 桌面 PNG/ICO 图标
.github/workflows/      CI 与跨平台 Cosign 签名发布工作流
```

## 许可证

本项目使用 [MIT License](LICENSE)。欢迎 issue 和 pull request；详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 开发者

| 项目 | 信息 |
| --- | --- |
| 开发者 | **戴亿** |
| QQ 邮箱 | [1703205607@qq.com](mailto:1703205607@qq.com) |
| QQ | [1703205607](https://wpa.qq.com/msgrd?v=3&uin=1703205607&site=qq&menu=yes) |
| Gmail | [daiy91004@gmail.com](mailto:daiy91004@gmail.com) |
| 抖音 | **daiyi091004** |
