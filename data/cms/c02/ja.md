---
title: "C02 ユーザー事例：padel-cli + OpenClaw でコート予約を自動化"
description: "高頻度でコート予約するユーザーが、padel-cli と OpenClaw のプラグイン導線で手動確認を減らし、予約運用を標準化した事例。"
---

# C02 ユーザー事例：padel-cli + OpenClaw でコート予約を自動化

## ケース概要

- **カテゴリ:** 自動化 / プラグインワークフロー
- **対象:** Playtomic の空き確認と予約を繰り返し行うユーザー
- **情報ソース:**
  - [OpenClaw Docs: Showcase](https://docs.openclaw.ai/start/showcase)
  - [joshp123/padel-cli](https://github.com/joshp123/padel-cli)

## 背景

夕方の人気時間帯でプレーするユーザーは、毎日の手動チェックに時間を取られていました。従来は次の流れです。

- アプリを開く
- 場所・日付・時間帯を指定して検索
- 同じ作業を毎日繰り返す

この作業を、OpenClaw と連携できる「スクリプト化された再利用可能フロー」に変えることが目的でした。

## ソースで確認できる機能

リポジトリと Showcase から、padel-cli には以下があると確認できます。

1. 空き確認・検索コマンド
2. 認証後の予約コマンド
3. Venue alias による反復運用
4. 自動化に向く `--json` 出力
5. nix-openclaw 連携向け `openclawPlugin` flake output

## 導入ステップ

### 1) CLI ビルドと基本検索を確認

```bash
go build -o padel
padel clubs --near "Madrid"
padel search --location "Barcelona" --date 2025-01-05 --time 18:00-22:00
```

### 2) 認証と予約フローを構成

```bash
padel auth login --email you@example.com --password yourpass
padel auth status
padel book --venue myclub --date 2025-01-05 --time 10:30 --duration 90
```

### 3) Venue alias で繰り返し操作を安定化

```bash
padel venues add --id "<playtomic-id>" --alias myclub --name "My Club" --indoor --timezone "Europe/Madrid"
padel venues list
padel search --venues myclub --date 2025-01-05 --time 09:00-11:00
```

### 4) OpenClaw プラグイン導線へ接続

README には `openclawPlugin` flake output が明記されています。nix-openclaw 環境では、プラグインパッケージが `PATH` に入り、skills がワークスペースへ symlink される構成です。

## 結果（確認可能な範囲）

- 手動アプリ操作中心の運用を、スクリプト実行中心に移せる
- 検索・空き確認・予約を一連の再利用可能ステップにできる
- JSON 出力と alias により、定型運用の安定性を高められる

## 確認済み事実と未検証項目

### ✅ 確認済み

- padel-cli は `search`、`availability`、`auth`、`book`、`venues` を提供
- padel-cli は JSON 出力をサポート
- `openclawPlugin` flake output がドキュメント化されている
- OpenClaw Showcase に "Padel Court Booking" として掲載されている

### ⚠️ 未検証（追加調査が必要）

- ユーザーごとの週次削減時間
- 都市・クラブ別の予約成功率向上
- ピーク時間帯での長期的な確保率の変化

## 実務メモ

- 認証情報・設定は `~/.config/padel` など保護されたローカルパスで管理する
- 自動化実行前にタイムゾーンと venue alias の対応を確認する
- 誤予約防止のため、重要操作には確認ステップを残す

## 参考リンク

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [padel-cli README](https://github.com/joshp123/padel-cli)
