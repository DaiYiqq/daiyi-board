# 第三方图形库（随仓库分发，页面不访问外网 CDN）

从 npm 官方包原样复制浏览器构建和该包自带的许可证。版本如下：

| 文件 | 包 | 版本 | 许可证 |
| --- | --- | --- | --- |
| `cytoscape.min.js` | [cytoscape](https://www.npmjs.com/package/cytoscape) | 3.30.4 | MIT，见 `LICENSE-cytoscape.txt` |
| `dagre.min.js` | [dagre](https://www.npmjs.com/package/dagre) | 0.8.5 | MIT，见 `LICENSE-dagre.txt` |
| `cytoscape-dagre.js` | [cytoscape-dagre](https://www.npmjs.com/package/cytoscape-dagre) | 2.5.0 | MIT，见 `LICENSE-cytoscape-dagre.txt` |
| `qrcode.js` | [qrcode-generator](https://www.npmjs.com/package/qrcode-generator) | 2.0.4 | MIT，见 `LICENSE-qrcode-generator.txt` |

`dagre.min.js` 是 dagre 0.8.5 发布的浏览器包（`dist/dagre.min.js`），里面已经打进 graphlib 和 lodash。graphlib 与 dagre 同为 Chris Pettitt 的 MIT 许可；lodash 为 MIT。这三份库和 `qrcode.js`（Kazuhiko Arase，MIT）不纳入本仓库的 CC BY-NC，各自保持原许可证。诊断结果页用 `qrcode.js` 在 canvas 上画分享图二维码，不在运行时请求生成接口。冒烟测试解码用的 jsQR 1.4.0（Apache-2.0）在 `scripts/vendor/`，页面不加载它。

页面只通过相对路径引用这些文件，不在运行时向 npm、CDN 或其它外网域名拉脚本、样式或字体。
