# AI駆動開発 実践ガイド

> 高専生のためのAI駆動開発 実践ガイド

![プレビュー](images/preview.png)

## 概要

AI駆動開発の実践手法をまとめた全19ページのA4ガイドブック。ダークテーマの洗練されたデザインで、AIとの協業における実践的なノウハウを体系的にまとめています。

## 閲覧方法

- **Web版:** [GitHub Pagesで閲覧](https://nekodigi.github.io/AI-docs/ai-driven-development.html)
- **PDFダウンロード:** [ai-driven-development.pdf](https://nekodigi.github.io/AI-docs/ai-driven-development.pdf)

## 内容

| パート | 内容 |
|--------|------|
| **PART I — 課題** | AIが酷評される理由、認知システム、組織の課題 |
| **PART II — 解決策** | コンテキスト管理、人間とAIの役割分担、ツール選択 |
| **PART III — 実践例** | Unity開発の教訓、採用マッチングシステム、AI活用事例集 |

## PDF生成方法

**前提:** Node.js 18+

```bash
npm install
npm run generate-pdf
```

## プロジェクト構成

```
├── ai-driven-development.html  ← ソースドキュメント
├── ai-driven-development.pdf   ← 生成されたPDF
├── generate-pdf.mjs            ← PDF生成スクリプト
├── images/                     ← 画像アセット
└── context/                    ← コンテンツ原稿
```

## 技術仕様

- A4 (210mm x 297mm) / ダークテーマ
- フォント: Noto Sans JP, Inter
- PDF生成: Puppeteer + pdf-lib (192 DPI)
