# DY Board

DY Board 是一个优先留出书写空间的全屏白板。启动后直接进入纯黑或纯白画布，主要操作集中在屏幕底边；不再显示公开课样例或演示文案。它保留多色笔迹、页面、撤销重做、摄像展台、本地工程和开发者信息。

> 当前开发版本：**0.2.0**。公开源码仓库：[DaiYiqq/daiyi-board](https://github.com/DaiYiqq/daiyi-board)。当前已发布的旧版安装包仍在 [v0.1.1 Release](https://github.com/DaiYiqq/daiyi-board/releases/tag/v0.1.1)；0.2.0 安装包会在推送版本标签并完成 GitHub Actions 后出现在 [Releases](https://github.com/DaiYiqq/daiyi-board/releases)。

## 主要功能

- **全屏空白画布**：Electron 桌面版启动即原生全屏；已安装 PWA 优先请求全屏显示。深色主题显示纯黑板，明亮主题显示纯白板。普通浏览器受安全限制，网页不能在未获用户手势时强制隐藏浏览器界面，但应用画面始终铺满可视区域。
- **简洁底部工具栏**：画笔、选择、橡皮、多色选择、自定义颜色、笔触粗细、页面管理、撤销/重做、缩放、摄像展台、打开/保存工程、黑白主题和设置均放在底部。可在设置中显隐常用工具、开启紧凑布局，并拖动调整绘图工具顺序。
- **书写与编辑**：支持指针/触屏、兼容设备压感；笔迹可选择、移动、等比缩放和删除；支持 Ctrl/⌘+Z 撤销、Ctrl/⌘+Y 重做。
- **页面与本地工程**：可新建、切换、重命名、清空和删除页面；自动保存到当前浏览器/Electron 用户配置文件，可导入或导出 `.daiyi-board.json` 工程。数据留在本地，不上传；升级不会主动清除既有白板数据，旧工程格式与本地存储键保持兼容。
- **摄像展台**：识别已连接的视频输入设备，允许选择/切换摄像头，在实物画面上做彩色批注；视频和批注在本地处理。设备发现和访问取决于浏览器 API、HTTPS/localhost、安全权限、系统授权及驱动。
- **开发者资料**：应用内“关于”及本 README 均列出完整联系方式。

## 获取与安装

0.2.0 的桌面安装包将在版本发布成功后放到 [GitHub Releases](https://github.com/DaiYiqq/daiyi-board/releases)。目前可查看上一版 [v0.1.1 安装包](https://github.com/DaiYiqq/daiyi-board/releases/tag/v0.1.1)。目标平台的公开发布工作流会生成 Windows NSIS 安装程序、macOS DMG/ZIP 与 Linux AppImage/DEB，并附带校验清单及 Sigstore 签名文件。当前 workflow runner 提供的架构以发行说明为准。

桌面 NSIS 安装向导提供许可协议、安装位置选择、开始菜单/桌面快捷方式、安装完成启动应用及标准卸载入口；包元数据列出开发者“戴亿”。默认工作流使用 GitHub OIDC/Cosign 对 SHA256 清单进行 keyless 签名，并为安装资产生成 GitHub provenance。它不等同于开发者个人 GPG/SSH 提交签名或 Windows/macOS 厂商代码签名；本仓库不含个人私钥、Windows 代码签名证书或 macOS Developer ID/公证凭证。

### 发布资产验证

在 Release 下载 SHA256 清单、`SHA256SUMS.sigstore.json` bundle 和对应安装包后，可运行：

```bash
sha256sum -c SHA256SUMS
cosign verify-blob SHA256SUMS \
  --bundle SHA256SUMS.sigstore.json \
  --certificate-identity-regexp 'https://github.com/DaiYiqq/daiyi-board/.github/workflows/release.yml@refs/tags/v.+' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

GitHub Actions 对 `v*` 标签运行 Windows/macOS/Linux 构建；成功后会生成 GitHub Release、SHA256 清单、Cosign bundle 和 provenance。

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
