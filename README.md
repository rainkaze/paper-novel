# PaperNovel

PaperNovel is a local-first reading interface experiment that presents fictional narrative text in an academic-paper visual language.

## Spike 1: academic paper layout

This repository currently contains only the paper-like reader prototype. It intentionally does **not** implement EPUB, TXT import, IndexedDB, a bookshelf, accounts, a backend, AI, or a Chrome extension.

The prototype compares two pagination approaches:

- **Prototype A — CSS Columns:** a fixed A4-like page uses a two-column CSS layout and horizontal page translation.
- **Prototype B — Explicit pages:** a hidden DOM measurement column greedily distributes blocks into two-column page models and splits overlong paragraphs.

The included narrative is an artificial test fixture written for layout testing. No real novel text is included.

## Tech Stack

- React
- TypeScript
- Vite

## Target Environment

- Windows
- Chrome

## Commands

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
```

## Current limitations

- The explicit paginator is an experimental greedy algorithm, not a production pagination engine.
- CSS Columns is intentionally implemented as a comparison prototype, not a final reading architecture.
- Text is generated from a small artificial fixture and is not an EPUB/TXT ingestion test.
