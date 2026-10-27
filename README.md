# DY白板 · DaiYi Board

一款面向课堂、讲解与现场演示的开源白板。用几笔整理想法，也可以接入摄像头，把实物展示与画面批注放在同一个工作区。应用主界面以「墨迹实验室」为设计方向：深墨色操作台、电光青工具状态，中央保留一张清晰、可书写的纸面画布。

> 当前版本：0.1.1 · 网页/PWA 与 Electron 桌面端。公开源码镜像：[DaiYiqq/daiyi-board](https://github.com/DaiYiqq/daiyi-board)。Linux AppImage/DEB 已在本地构建。首轮 `v0.1.0` 三平台安装器构建完成后，electron-builder 的自动上传阶段因未配置其专用令牌而失败；打包脚本现显式关闭该自动上传，`v0.1.1` 正式签名 Release 尚待重跑。

## 功能

- **白板与页面**：新增、切换、重命名、删除页面；画布缩放与演示模式；画笔、橡皮、选择、笔迹移动及对象缩放/删除。
- **书写**：多色画笔、笔触粗细、支持指针/触屏绘制；支持 Ctrl/⌘+Z 撤销、Ctrl/⌘+Y 重做。
- **本地工程**：自动恢复当前工作区；通过「打开」载入工程 JSON 并恢复保存时的活动页，「保存工程」导出 `.daiyi-board.json`。数据默认存放于浏览器/Electron 本地存储，不上传云端。
- **自定义界面**：墨色/明亮主题、左右工具栏布局、紧凑模式和拖动重排工具栏；偏好设置本地保存。
- **展台模式**：扫描系统视频输入、设备切换、实时预览，并可在摄像头画面上绘制彩色批注。视频只在本地显示，不会上传。
- **安装**：支持符合条件浏览器的 PWA 安装；Electron 可构建 Windows NSIS 安装程序、macOS DMG/ZIP、Linux AppImage/DEB。
- **开发者信息**：应用内「关于」页面以及本 README 均包含完整开发者联络信息。

## 快速开始

要求 Node.js 22 与 pnpm 11。克隆仓库后安装依赖并启动开发服务器：

```bash
corepack enable
pnpm install
pnpm dev
```

访问 `http://localhost:3000`。生产构建和类型检查：

```bash
pnpm build
pnpm typecheck
```

## 桌面开发与安装包

在目标操作系统运行对应命令。应用和 Electron 运行时应在对应平台打包；完整平台矩阵由 GitHub Actions 发布工作流自动构建。

| 系统 | 命令 | 产物 |
| --- | --- | --- |
| Windows x64 / arm64 | `pnpm desktop:win` | NSIS `.exe` 安装向导 |
| macOS | `pnpm desktop:mac` | `.dmg`、`.zip` |
| Linux | `pnpm desktop:linux` | `.AppImage`、`.deb` |
| 本机目录试运行 | `pnpm desktop:pack` | 未安装目录包 |

Windows 安装程序采用完整的 NSIS 安装引导流程，提供许可协议、安装位置选择、开始菜单/桌面快捷方式、安装完成启动应用及标准卸载入口。应用包元数据列出开发者/发布者“戴亿”；许可文件为 MIT。Windows 可执行文件的**组织身份验证签名**及 macOS Developer ID/公证不包含于默认免费构建配置，必须由开发者提供有效证书和密钥后才能启用；未签名应用首次运行可能显示系统安全提示。

在非 localhost 环境使用网页摄像头时，浏览器要求 HTTPS 安全上下文。首次进入展台模式需要允许摄像头访问；Electron 桌面版需在操作系统隐私设置中授予相机权限。切换或退出展台时，应用会停止摄像流。

## PWA 安装与数据

通过 HTTPS 部署后，可以从支持 PWA 的浏览器菜单选择「安装应用」。离线 Service Worker 缓存已访问的应用外壳资源；摄像头仍需本地硬件及系统授权。每个浏览器/Electron 用户配置文件的白板数据互相独立，建议定期使用「保存工程」备份。清除站点数据前请先导出重要工程。

## GitHub Releases、校验与签名

推送 `v*` 版本标签后，`.github/workflows/release.yml` 会在 Windows、macOS、Linux runner 上构建安装包，生成 `SHA256SUMS`，使用 GitHub Actions OIDC 和 Sigstore/Cosign 对校验清单进行 keyless 签名，并为构建产物生成 GitHub build provenance attestations。发布者可在 Release 页下载各平台安装包、校验清单和签名 bundle。

校验示例：

```bash
sha256sum -c SHA256SUMS
cosign verify-blob SHA256SUMS \
  --bundle SHA256SUMS.sigstore.json \
  --certificate-identity-regexp 'https://github.com/DaiYiqq/daiyi-board/.github/workflows/release.yml@refs/tags/v.+' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

GitHub Actions 的 Sigstore 签名证明「产物由此 GitHub 工作流构建」，**不等同于戴亿个人的 GPG/SSH 提交签名或 Windows/macOS 厂商代码签名**。为使提交显示 Verified，开发者须在自己的 Git 环境生成/保管 GPG 或 SSH 签名私钥，将公钥添加到对应 GitHub 账号，并对提交签名；私钥不得提交到本仓库。当前执行环境没有戴亿的个人私钥，因此本项目不会伪造个人签名。

## 工程结构

```text
src/                    React/TypeScript 白板界面、交互与样式
public/                 PWA 清单、离线 Service Worker 与应用标识
electron/               桌面主进程与受限 preload
.github/workflows/      CI 检查与跨平台签名发布工作流
```

## 已知限制

- 0.1.0 使用本地浏览器存储自动恢复；工程文件导入导出用于跨设备搬运，目前没有云同步和多人协作。
- 展台批注属于当前会话，不会自动嵌入导出的白板工程；目前选择工具/橡皮对笔迹对象操作。
- 目前交付的是源代码、开发预览和跨平台构建配置；实际签名安装包需在对应操作系统或 GitHub Actions 中构建。商店分发所需证书、公证与账户由开发者自行提供。
- 在网页端，摄像设备识别受浏览器 API、HTTPS/localhost、安全权限及操作系统驱动限制。

## 许可证

本项目使用 [MIT License](LICENSE)。

## 开发者

| 项目 | 信息 |
| --- | --- |
| 开发者 | **戴亿** |
| QQ 邮箱 | [1703205607@qq.com](mailto:1703205607@qq.com) |
| QQ | [1703205607](https://wpa.qq.com/msgrd?v=3&uin=1703205607&site=qq&menu=yes) |
| Gmail | [daiy91004@gmail.com](mailto:daiy91004@gmail.com) |
| 抖音 | **daiyi091004** |

## 贡献

欢迎提交 issue 与 pull request。请先描述复现步骤、系统/浏览器/设备环境与预期表现；涉及摄像头问题时，请说明操作系统授权状态。提交代码前运行 `pnpm build`，避免将个人密钥、签名证书、白板工程或本机配置提交到仓库。详细约定见 [CONTRIBUTING.md](CONTRIBUTING.md)。
