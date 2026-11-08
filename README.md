# PaperNovel

PaperNovel 是一个本地优先的阅读界面实验，用学术论文的视觉语言呈现虚构叙事文本，并支持导入本地 UTF-8 TXT 文本进行阅读。

## Spike 1：学术论文式版面

本仓库目前包含论文式阅读器原型，以及 Spike 3A.1 的最小 TXT 导入能力。项目有意不实现 EPUB、IndexedDB、书架、账号、后端、AI 或 Chrome 扩展。

原型对比两种分页方案：

- **方案 A —— CSS Columns：** 固定 A4 式页面使用双栏 CSS 布局与横向翻页位移。
- **方案 B —— Explicit pages：** 隐藏的 DOM 测量栏将文本块贪心分配到双栏页面模型，并对超长段落进行切分。

仓库附带的叙事文本是为版面测试编写的人工 fixture，不包含真实小说文本。

## Spike 3A.1：TXT 导入（内存态）

- 在左侧控制栏选择「导入 TXT」，可导入本地 `.txt` 文件（UTF-8 编码，最大 10MB）。
- 文本会被解析为 `BookDocument` 并直接进入阅读；书名取自文件名。
- 导入仅保存在内存中，刷新页面后恢复示例文本；不写入 IndexedDB，不做书架，不做阅读进度持久化。
- 非 UTF-8 编码、空文件或超过 10MB 的文件会在页面内显示中文错误提示。
- 当前不实现 EPUB 导入。

## 技术栈

- React
- TypeScript
- Vite
- Playwright（端到端测试）

## 目标环境

- Windows
- Chrome / Edge

## 命令

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

## 当前限制

- Explicit 分页器是实验性的贪心算法，不是生产级分页引擎。
- CSS Columns 是有意保留的对照原型，不是最终阅读架构。
- TXT 导入仅支持 UTF-8，且只保存在内存中。
- 尚未实现 EPUB、IndexedDB 持久化、书架和阅读进度保存。

## 后续计划

- Spike 3A.2：IndexedDB 持久化与书架。
- Spike 3A.3：阅读进度保存与恢复。

## 文档语言约定

项目说明文档默认使用中文。代码标识符、命令、文件路径与专有名词（如 React、TypeScript、Vite、Playwright、IndexedDB）保留英文。
