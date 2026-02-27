---
title: "SNAG で画面断片を OpenClaw 向け Markdown に変換する"
description: "SNAG + OpenClaw ワークフローで、画面の一部を markdown 化し、LLM へのコンテキスト投入を高速化する方法。"
---

# C03 ユーザー事例：SNAG で画面断片を OpenClaw 向け Markdown に変換する

## ケース概要

- **カテゴリ:** 自動化 / 開発ワークフロー
- **対象ユーザー:** 画面上のコード/UI断片をAIチャットへ頻繁に渡すユーザー
- **出典:**
  - [OpenClaw Docs: Showcase](https://docs.openclaw.ai/start/showcase)
  - [am-will/snag](https://github.com/am-will/snag)

## 背景

デバッグや調査の場面では、UIの一部・コード・図を LLM に渡すために手作業で書き起こすことが多く、時間と正確性の面でコストが発生します。

このケースでは、次の流れを再現可能な手順として固定します。

- 画面範囲を選択してキャプチャ
- markdown へ変換
- OpenClaw の会話へ貼り付け

## ソースで確認できる機能

SNAG README と OpenClaw Showcase から確認できる内容:

1. SNAG は screenshot-to-text の CLI ツール
2. 範囲選択とマルチモニター対応
3. テキスト/コード/図表/UI を処理し、markdown 形式でクリップボードへ出力
4. Google Gemini / OpenRouter / Z.AI の複数プロバイダーに対応
5. OpenClaw Showcase に SNAG（"Screenshot-to-Markdown"）が掲載

## 実装パス

### 1) SNAG をインストール

```bash
uv tool install git+https://github.com/am-will/snag.git
```

### 2) プロバイダーとAPIキーを設定

```bash
snag --setup
```

環境に合わせて provider / model / API key を設定します。

### 3) キャプチャして変換

```bash
snag
```

選択した画面領域が markdown 化され、結果がクリップボードに入ります。

### 4) OpenClaw ワークフローへ接続

クリップボード内容を OpenClaw の会話に貼り付け、デバッグ・要約・レビュー作業を継続します。

## 結果（確認可能な範囲）

- 手動転記だった工程をコマンドベースに置き換え可能
- markdown の即時クリップボード出力でコンテキスト投入が容易
- 複数プロバイダー対応で既存AI環境へ合わせやすい

## 確認済み事項と未検証事項

### ✅ 確認済み（出典あり）

- SNAG は範囲選択キャプチャとマルチモニターに対応
- SNAG は Gemini / OpenRouter / Z.AI をサポート
- SNAG は markdown 用のテキストをクリップボードへ出力
- OpenClaw Showcase に SNAG が掲載されている

### ⚠️ 未検証（ユーザーヒアリング・計測が必要）

- 1回あたりの作業時間短縮率
- 手動転記と比較した誤記率の変化
- 長期的なデバッグ効率への定量効果

## 実運用メモ

- macOS では初回実行時に画面収録権限が必要
- グローバルショートカット利用時は `snag` が PATH 上にあることを確認
- APIキーは SNAG 推奨のローカル設定ディレクトリ（`~/.config/snag/`）で管理

## 参考リンク

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [SNAG README](https://github.com/am-will/snag)
