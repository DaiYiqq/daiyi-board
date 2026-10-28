# DY Board 0.2.0 改版方案

## 实施方式

沿用现有 React + TypeScript + Vite + Electron 项目，不重建、不替换数据模型。Electron 主窗口启动即进入全屏；PWA manifest 使用全屏显示模式，Web 页面使用 viewport 全幅布局。启动页改为空白书写面，不显示公开课样例、引导标题或装饰网格。暗色主题对应纯黑画布，明亮主题对应纯白画布。将主要工具、颜色、笔触、撤销/重做、页面、相机、工程导入导出、主题和设置集中到屏幕底边的简洁工具栏。

视觉身份更新为 **DY Board**：以黑白、高对比和克制分隔线为主，品牌标识为居中、倾斜的大号「Yi+」字形；图标将同步用于网页/PWA、Electron 桌面包与项目元数据。更新桌面包元信息、应用内版本文字、README 和待办，再将版本升至 0.2.0。保留现有页面数据结构、localStorage key、摄像头本地权限/处理、笔迹/撤销重做、文件 JSON 格式、开发者联系方式、许可证、跨平台打包与 Sigstore 工作流。

全屏的行为按宿主区分：Electron 桌面端通过 Electron 原生窗口启动全屏；已安装 PWA 请求 manifest fullscreen。普通浏览器不允许网页在没有用户手势时强制进入浏览器级全屏，但页面内容本身始终占满可视区。

## 设计

- **Design Movement**：希沃式课堂白板的直接操作逻辑，结合极简黑白工作台。
- **Core Principles**：画布优先；控件集中底部；黑白背景清晰；功能保持可发现且不打断书写。
- **Color Philosophy**：画布只使用纯黑或纯白，依据深色/浅色主题切换；工具台采用低对比中性色，选中状态使用单一克制强调色。
- **Layout Paradigm**：全屏单画布，底边一条紧凑工具带；无侧栏、无顶部演示标题、无占位课程内容。
- **Signature Elements**：倾斜的 Yi+ 图标；贯穿全宽的底部工具带；没有边框装饰的整面空白画布。
- **Interaction Philosophy**：单击即切换工具，颜色和页面就近可改，文件/摄像/设置仍易到达；快捷键与现有工程兼容。
- **Animation**：除工具状态轻微过渡外不使用装饰动画；画布布局切换立即响应。
- **Typography System**：系统无衬线字体；工具按钮短标签/原生提示，避免品牌装饰字体影响课堂可读性。
- **Brand Essence**：打开就能写、把空间让给想法的全屏白板；直接、安静、可靠。
- **Brand Voice**：按钮使用简短动作词。示例：「画笔」「新建」「保存工程」；空白画面不放促销或教程文案。
- **Wordmark & Logo**：深色圆角方形中置大号 Yi+ 几何字形，整体向右上倾斜。
- **Signature Brand Color**：中性黑/白为主体，选中工具用低饱和青蓝作单一定位色。

## 项目结构

- `src/App.tsx`：白板笔迹、页面/文件、摄像头、底部工具栏与设置/开发者面板。
- `src/style.css`：全屏画布、黑白主题、底部工具带与窄屏布局。
- `electron/main.cjs`：桌面窗口启动全屏和应用标题/菜单栏行为。
- `public/manifest.webmanifest`、`public/board-mark.svg`、`build/icon.png`/`icon.ico`：网页/PWA 与桌面品牌资产。
- `package.json`：DY Board 显示名、版本和 Electron 安装包元数据；`README.md` 与 `TODO.md` 同步。
- `.github/workflows/release.yml`：复用既有 Windows/macOS/Linux 安装、SHA256、Cosign keyless 签名及 provenance 流程。

## 约束

不清除用户已有 localStorage 白板内容，不更改导入/导出的 JSON 格式，不提交开发者个人签名私钥。发行版本号升为 0.2.0；公开仓库发布使用 v0.2.0 标签，成功发布状态以 GitHub Actions/Release 结果为准。
