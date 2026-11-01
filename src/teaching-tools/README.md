# 教学工具集成说明

本文档说明如何在 DY Board 中新增一个教学工具、postMessage 通信协议、以及许可证注意事项。

## 1. 如何新增一个教学工具

教学工具的唯一数据源是 `src/teaching-tools/registry.ts`。新增工具只需在该文件的 `TEACHING_TOOLS` 数组中追加一项即可，面板、分类、搜索、收藏、最近使用、属性面板都会自动读取。

### 工具字段

| 字段 | 说明 |
|---|---|
| `id` | 全局唯一标识（kebab-case） |
| `name` | 显示名称 |
| `subject` | 学科：数学 / 物理 / 化学 / 生物 / 地理 / 历史 / 通用工具 |
| `description` | 一句话简介 |
| `license` | 许可证（MIT / Apache-2.0 / BSD / GPL…；不确定填「待核对」） |
| `sourceUrl` | 来源仓库或页面 URL（勿自行猜测，用附录地址） |
| `sourceName` | 来源仓库的展示名 |
| `offline` | 是否离线可用 |
| `version` | 版本号（未知填 `-`） |
| `loadMode` | `local-iframe` / `remote-iframe` / `link` |
| `localPath` | `local-iframe` 时：相对 `public/` 的路径 |
| `entryUrl` | `remote-iframe` / `link` 时：远程 URL |
| `paramsSchema` | 参数字段定义（见下）；第三方自包含页面填 `[]` |
| `defaultParams` | 默认参数对象 |
| `note` | 许可证 / 协议 / 降级说明 |

### 三种 loadMode

- **`local-iframe`**：把工具的静态 HTML/JS 放到 `public/teaching-tools/<id>/`，随应用打包、离线可用。用沙箱 iframe 承载。
- **`remote-iframe`**：远程页面，需网络，加载失败显示错误卡 + 重试。
- **`link`**：外部工具卡片，点击「来源」在新窗口打开（适合需后端、需摄像头、许可证受限或暂无法本地化的工具）。

### 参数 schema

```ts
paramsSchema: [
  { key: 'amplitude', label: '振幅', type: 'slider', min: 10, max: 90, step: 1, defaultValue: 45 },
  { key: 'mode', label: '模式', type: 'select', options: [{ label: 'A', value: 'a' }], defaultValue: 'a' },
  { key: 'showGrid', label: '显示网格', type: 'toggle', defaultValue: true },
  { key: 'expr', label: '表达式', type: 'text', defaultValue: 'sin(x)' },
],
```

右侧属性面板会按 schema 自动生成滑块 / 下拉框 / 开关 / 文本框。

## 2. postMessage 通信协议

白板主应用 ↔ 工具 iframe 之间通过 `postMessage` 通信。**只有实现了该协议的 `local-iframe`/`remote-iframe` 工具才支持参数面板与截图；第三方自包含页面不实现该协议，控件在其自身 UI 内。**

### 主应用 → 工具

| 消息 | 载荷 | 说明 |
|---|---|---|
| `whiteboard:init` | `{ params, theme }` | iframe 加载完成后下发初始参数与主题 |
| `whiteboard:set-params` | `{ params }` | 参数面板改动后下发 |
| `whiteboard:request-snapshot` | `{}` | 请求工具截图 |

### 工具 → 主应用

| 消息 | 载荷 | 说明 |
|---|---|---|
| `tool:ready` | `{ version }` | 工具就绪 |
| `tool:snapshot` | `{ dataUrl }` | 返回 PNG dataURL |
| `tool:state-changed` | `{ state }` | 回传可序列化状态（用于保存/恢复） |

主应用对消息做 **origin 校验**（`e.source === iframe.contentWindow`）与 **schema 校验**（只接受白名单消息类型，且校验字段类型）。

## 3. 白板元素模型

`teaching-tool` 元素保存在 `Page.tools` 数组：

```ts
{ id, toolId, toolVersion, params, x, y, w, h, snapshot? }
```

坐标归一化到 0..1。保存白板时随 `BoardData` 序列化；重新打开时按 `toolId` 从注册表加载，`toolVersion` 不匹配时在元素上显示「版本不兼容」提示而不阻塞白板打开。

截图会作为独立的 `image` 元素插入 `Page.images`，与 teaching-tool 一样可移动/缩放/删除/撤销重做。

## 4. 许可证注意事项

- 优先 MIT / Apache-2.0 / BSD。
- GPL / AGPL / 非商业（如 CC BY-NC）工具要单独标注许可证；若与主包许可冲突，改用 `link`（新窗口打开）而非复制代码。
- 附录中未明确许可证的工具，集成前核对仓库 LICENSE 文件，并在注册表 `license` 标注（或写「待核对」）。
- 已复制进 `public/teaching-tools/` 的第三方资源，其 LICENSE 文件已一并保留；清单见 `public/teaching-tools/NOTICE.md`。
