---
title: "C01 ユーザー事例：nix-openclaw による OpenClaw の宣言的デプロイ"
description: "小規模運用チームが nix-openclaw と Home Manager を使い、macOS / Linux で OpenClaw を再現可能かつロールバック可能にした導入事例。"
---

# C01 ユーザー事例：nix-openclaw による OpenClaw の宣言的デプロイ

## ケース概要

- **カテゴリ:** デプロイ / インフラ
- **対象:** OpenClaw を継続運用するエンジニアリングチーム
- **参照元:**
  - [OpenClaw Docs: Nix Installation](https://docs.openclaw.ai/install/nix)
  - [openclaw/nix-openclaw](https://github.com/openclaw/nix-openclaw)

## 背景

3名のプラットフォームチームは、Mac mini と Linux VPS の両方で OpenClaw を運用していました。従来は手作業インストール中心で、環境差分が積み上がっていました。

- マシンごとに CLI バージョンがずれる
- 設定変更がローカルに散在し追跡しづらい
- アップデート失敗時の復旧が遅い

そこで、再現性とロールバック性を重視した宣言的運用へ移行しました。

## 移行前の課題

1. **構成ドリフト**（環境ごとの差分拡大）
2. **再現性不足**（新規マシン導入が不安定）
3. **更新リスク**（失敗時の戻し手順が曖昧）
4. **責務の混在**（固定設定と実行時状態の境界が不明瞭）

## nix-openclaw 採用理由

公式ドキュメントと README から、以下が決め手になりました。

- OpenClaw 向け **Home Manager モジュール**
- Nix による依存関係の固定化
- サービス管理（macOS は **launchd**、Linux は **systemd --user**）
- **Nix mode**（`OPENCLAW_NIX_MODE=1`）で自己変更フローを抑止
- Home Manager generations による高速ロールバック

## 導入ステップ

### 1) 公式テンプレートから flake を作成

`templates/agent-first/flake.nix` をベースに、ユーザー名・システム種別・チャネル情報を設定。

### 2) 「固定設定」と「実行時状態」を分離

- 固定設定: flake / `programs.openclaw.config`
- 管理文書: `AGENTS.md`、`SOUL.md`、`TOOLS.md`
- 実行時データ: `~/.openclaw`

これは Golden Paths の「pinned config vs runtime state」に沿った構成です。

### 3) シークレットをファイル参照で注入

Telegram token や API key は設定ファイル直書きではなく、ファイルパスで渡しました。

### 4) 適用と確認

```bash
home-manager switch --flake .#<user>
```

確認コマンド:

- macOS: `launchctl print gui/$UID/com.steipete.openclaw.gateway`
- Linux: `systemctl --user status openclaw-gateway`

## 導入後の変化

- 新規環境構築が flake ベースで標準化
- バージョン固定により更新時の予測可能性が向上
- `home-manager switch --rollback` で復旧が簡潔化
- 運用知識が個人依存から設定レビュー中心へ移行

## 実運用メモ

- macOS の TCC 権限（画面収録など）は初回のみ手動承認が必要です。
- 宣言的運用では Nix mode を有効に保つのが安全です。
- プラグインソースはピン留めし、デプロイ変更をレビュー対象にしましょう。

## 参考

- [OpenClaw Nix インストール概要](https://docs.openclaw.ai/install/nix)
- [nix-openclaw README / モジュール設定](https://github.com/openclaw/nix-openclaw)
- [Golden Paths](https://github.com/openclaw/nix-openclaw/blob/main/docs/golden-paths.md)
