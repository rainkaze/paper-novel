# PaperNovel

PaperNovel 是一个本地优先的阅读界面实验，用学术论文的视觉语言呈现虚构叙事文本，支持导入本地 UTF-8 TXT 文本、IndexedDB 书架，以及按书籍保存阅读进度与阅读偏好。

## Spike 1：学术论文式版面

本仓库目前包含论文式阅读器原型、TXT 导入、最小书架与阅读进度。项目有意不实现 EPUB、搜索、注释、同步、账号、后端或 AI。

原型对比两种分页方案：

- **方案 A —— CSS Columns：** 固定 A4 式页面使用双栏 CSS 布局与横向翻页位移。
- **方案 B —— Explicit pages：** 隐藏的 DOM 测量栏将文本块贪心分配到双栏页面模型，并对超长段落进行切分。

仓库附带的叙事文本是为版面测试编写的人工 fixture，不包含真实小说文本。

## Spike 3A.1：TXT 导入

- 在左侧控制栏选择「导入 TXT」，可导入本地 `.txt` 文件（UTF-8 编码，最大 10MB）。
- 文本会被解析为 `BookDocument` 并直接进入阅读；书名取自文件名。
- 导入成功后会自动保存到本地 IndexedDB。
- 非 UTF-8 编码、空文件或超过 10MB 的文件会在页面内显示中文错误提示。
- 当前不实现 EPUB 导入。

## Spike 3A.2：IndexedDB 持久化与书架

- 已保存的书籍存放在浏览器 IndexedDB 中；刷新页面后自动恢复，并默认打开最近更新的一本。
- 书架展示书名、章节数、字数与导入时间；点击书名打开书籍。
- 删除书籍前会显示页面内确认；删除当前书籍后回退到列表中的下一本，书架为空时回到示例文本。
- 「恢复示例文本」只切换当前显示内容，不会删除已保存的书籍。
- IndexedDB 不可用时会显示非阻塞中文提示，示例文本仍可正常使用。

## Spike 3A.3：阅读进度与阅读偏好

- 按书籍保存 `ReadingPosition`（章节、段落、字符偏移）、字号与视图模式（CSS Columns / Explicit pages）。
- 翻页或滚动停稳后约 400ms 防抖保存；切换书籍、导入新书或恢复示例文本前会先尝试保存当前进度。
- 刷新页面或重新打开书籍时恢复上次位置、字号与模式；保存位置超出当前文档范围时回退到第 1 页。
- 字号变化会重新分页并尽量保持原阅读位置；视图模式切换也会保存为该书偏好。
- 多本书的进度与偏好互相独立；书架显示「第 X / Y 页」，未开始阅读的书籍显示「未开始」。
- 示例文本不写入书架，也不产生阅读进度。
- IndexedDB schema 已升级到 v2，新增 `progress` store，并保留 v1 的 `books`、`documents`、`meta` 数据。
- 阅读进度为本地保存；清除浏览器站点数据会丢失，且不涉及跨设备同步或账号。

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
- 阅读进度与偏好仅保存在浏览器本地 IndexedDB；清除站点数据会丢失，暂不支持跨设备同步。
- TXT 导入仅支持 UTF-8；暂不支持 EPUB、搜索、注释与批量导入。

## 后续计划

- EPUB 导入。
- 搜索与注释。
- 可选的跨设备同步。

## 文档语言约定

项目说明文档默认使用中文。代码标识符、命令、文件路径与专有名词（如 React、TypeScript、Vite、Playwright、IndexedDB）保留英文。
