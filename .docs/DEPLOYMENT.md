# Touhou-Isekai-Mining 发布说明

正式英文名为 `Touhou-Isekai-Mining`，npm 包名为 `touhou-isekai-mining`，首个仓库版本为 `0.1.0`，许可证为 `AGPL-3.0-only`，完整条款见根目录 `LICENSE`。

## 自动发布

向 `main` 推送后，`.github/workflows/pages.yml` 自动安装锁定依赖、构建 Vite 静态网页并部署到 GitHub Pages；也可在 Actions 页面手动运行。只有构建成功后才会发布。

- 仓库：<https://github.com/YoKONCy/Touhou-Isekai-Mining>
- 网页：<https://yokoncy.github.io/Touhou-Isekai-Mining/>
- Pages 发布来源：GitHub Actions。
- 首次启用仓库时先设置 Pages 发布来源，再运行工作流；若首批推送抢在启用之前报 404，启用后重跑该任务即可。当前仓库已启用并完成首次发布。
- 构建环境：Node.js 22，`npm ci`，`npm run build -- --base "/Touhou-Isekai-Mining/"`。
- 工作流使用 Pages 返回的 `base_path` 设置资源路径；本地 `npm run dev` 仍使用根路径。

## 仓库范围

源码、运行时资源、MOD 示例、设计文档、依赖锁定文件与部署配置纳入 Git。依赖、构建产物、研究/预览目录、本机环境、资源压缩清单与一次性维护工具由 `.gitignore` 排除。

本地目录暂时仍叫 `Touhou-Isekai-Mine`。IndexedDB 数据库名 `touhou-isk` 与音量设置键 `touhou-isekai-mine:audio-v1` 保留，以继续读取本地原有数据；它们不是正式项目名或游戏版本号。网页存档按浏览器站点隔离，本地开发站点的存档不会自动出现在 Pages 站点。

根目录 README 留待项目作者编写。标题视频的内嵌英文文字暂时沿用已有资源，后续再调整。
