---
title: "C05 ユーザーケース：linear-cli + OpenClaw で Linear の課題運用を PR までつなぐ"
description: "公開ドキュメントを根拠に、ターミナルでの Linear 課題操作から PR 連携までを再現可能な形で構成し、OpenClaw と連携する。"
---

# C05 ユーザーケース：linear-cli + OpenClaw で Linear の課題運用を PR までつなぐ

## 概要

- **カテゴリ：** 自動化 / 開発ワークフロー
- **対象：** Linear を使い、ターミナル中心の運用と AI 連携を進めたいチーム
- **情報源：**
  - [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
  - [Finesssee/linear-cli](https://github.com/Finesssee/linear-cli)
  - [linear-cli examples](https://github.com/Finesssee/linear-cli/blob/master/docs/examples.md?raw=1)

## 背景

課題対応がブラウザ、ローカル端末、チャットに分散すると、文脈の切り替えが多くなり、定常作業の再利用性が下がります。

本ケースは、ドキュメントで確認できる次の流れを扱います。

1. `linear-cli` で課題操作と git 操作を実行する
2. 機械可読の出力を保持する
3. OpenClaw に文脈を渡して後続判断を進める

## ソースで確認できる機能

README、examples ドキュメント、OpenClaw Showcase から確認できる内容：

1. `linear-cli` は issues / projects / labels / teams / cycles / comments など幅広いコマンドを提供する。
2. 認証はブラウザ OAuth と API key の両方に対応する。
3. 課題ワークフローには start / stop / close などの操作が含まれる。
4. Git 連携で課題に紐づくブランチ作成と PR 作成が可能（`linear-cli g checkout`、`linear-cli g pr`）。
5. JSON/NDJSON 出力があり、スクリプトや agent 連携に利用できる。
6. OpenClaw Showcase に Linear CLI がコミュニティプロジェクトとして掲載されている。

## 実装ステップ

### 1) インストールと確認

```bash
cargo install linear-cli
linear-cli --help
```

### 2) 認証設定

```bash
linear-cli auth oauth
# または
linear-cli config set-key lin_api_xxx
```

### 3) ターミナルで課題フローを実行

```bash
linear-cli i list --mine --output json --compact
linear-cli i start LIN-123 --checkout
linear-cli i comment LIN-123 -b "Work started from CLI workflow"
```

### 4) PR 連携後に OpenClaw で継続

```bash
linear-cli g pr LIN-123 --draft
```

コマンド結果を OpenClaw に渡し、レビュー観点、マージ準備、次アクションの調整を続行します。

## 結果（根拠ベース）

- 課題から PR までの流れを CLI で反復実行できる。
- 構造化出力により自動化と AI への文脈受け渡しがしやすくなる。
- 日常操作での UI 往復依存を下げられる。

## 確認済み事項と未検証事項

### ✅ 確認済み

- Linear CLI は課題運用、git 連携、ワークスペース操作の機能を提供する。
- OAuth/API key 認証フローが文書化されている。
- JSON/NDJSON 出力が文書化されている。
- Showcase に Linear CLI が掲載されている。

### ⚠️ 未検証（チーム計測が必要）

- 課題1件あたりの平均リードタイム変化
- CLI 導入後のレビュー待ち時間の変化
- 複数リポジトリ運用での中長期的な処理量変化

## 実務メモ

- チーム内で課題識別子（例: `LIN-123`）表記を統一する。
- AI 連携では機械可読出力を優先して渡す。
- 環境ごとに認証方法を明示し、ワークスペース取り違えを防ぐ。

## 参照リンク

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [linear-cli repository](https://github.com/Finesssee/linear-cli)
- [linear-cli examples](https://github.com/Finesssee/linear-cli/blob/master/docs/examples.md?raw=1)
