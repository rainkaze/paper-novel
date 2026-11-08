# PaperNovel

PaperNovel 是一个本地优先的阅读界面实验，用学术论文的视觉语言呈现虚构叙事文本。

## Spike 1：学术论文式版面

本仓库目前只包含论文式阅读器原型。它有意**不**实现 EPUB、TXT 导入、IndexedDB、书架、账号、后端、AI 或 Chrome 扩展。

原型对比两种分页方案：

- **方案 A —— CSS Columns：** 固定 A4 式页面使用双栏 CSS 布局与横向翻页位移。
- **方案 B —— Explicit pages：** 隐藏的 DOM 测量栏将文本块贪心分配到双栏页面模型，并对超长段落进行切分。

仓库附带的叙事文本是为版面测试编写的人工 fixture，不包含真实小说文本。

## 技术栈

- React
- TypeScript
- Vite

## 目标环境

- Windows
- Chrome

## 命令

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
```

## 当前限制

- Explicit 分页器是实验性的贪心算法，不是生产级分页引擎。
- CSS Columns 是有意保留的对照原型，不是最终阅读架构。
- 文本由小型人工 fixture 生成，尚不是 EPUB/TXT 导入测试。

## 文档语言约定

项目说明文档默认使用中文。代码标识符、命令、文件路径与专有名词（如 React、TypeScript、Vite、Playwright、IndexedDB）保留英文。
