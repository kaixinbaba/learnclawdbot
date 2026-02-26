---
title: "C04 ユーザー事例：bambu-cli + OpenClaw で BambuLab 3Dプリント運用を標準化"
description: "公開ドキュメントに基づき、bambu-cli と OpenClaw で再現可能な BambuLab 制御ワークフローを構築する方法。"
---

# C04 ユーザー事例：bambu-cli + OpenClaw で BambuLab 3Dプリント運用を標準化

## ケース概要

- **カテゴリ:** 自動化 / ハードウェア運用
- **対象ユーザー:** BambuLab の印刷操作をコマンドベースで安定化したいユーザー
- **出典:**
  - [OpenClaw Docs: Showcase](https://docs.openclaw.ai/start/showcase)
  - [tobiasbischoff/bambu-cli](https://github.com/tobiasbischoff/bambu-cli)
  - [bambu-cli README (raw)](https://github.com/tobiasbischoff/bambu-cli/blob/master/README.md?raw=1)

## 背景

印刷オペレーションを GUI のみに依存すると、状態確認・印刷開始・設定切替などの反復作業が分断されやすくなります。

このケースでは、文書化されたコマンド中心の流れを採用します。

- 初期設定を一度実施
- 運用コマンドを反復利用
- 出力を OpenClaw 会話に渡して次アクションを整理

## ソースで確認できる機能

bambu-cli README と OpenClaw Showcase から確認できる内容:

1. `bambu-cli` は MQTT/FTPS/カメラ経由で BambuLab プリンタを操作する CLI。
2. インストールとクイックスタート（`brew install`、`config set`、`status`、`print start`）が明記されている。
3. 設定優先順位（flags > env > project config > user config）が定義されている。
4. 必要ポート（8883 MQTT、990 FTPS、6000 camera）が明記されている。
5. OpenClaw Showcase に “Bambu 3D Printer Control” がコミュニティ事例として掲載されている。

## 実装パス

### 1) bambu-cli をインストール

```bash
brew install tobiasbischoff/tap/bambu-cli
```

### 2) ファイルベースで access code を管理し、printer profile を設定

```bash
mkdir -p ~/.config/bambu
printf "%s" "YOUR_ACCESS_CODE" > ~/.config/bambu/lab.code
chmod 600 ~/.config/bambu/lab.code

bambu-cli config set --printer lab \
  --ip 192.168.1.200 \
  --serial AC12309BH109 \
  --access-code-file ~/.config/bambu/lab.code \
  --default
```

### 3) 運用コマンドを実行

```bash
bambu-cli status
bambu-cli print start ./benchy.3mf --plate 1
```

### 4) OpenClaw ワークフローへ接続

CLI 出力を OpenClaw に渡し、状態確認・運用手順・トラブル対応の判断を継続します。

## 結果（確認可能な範囲）

- GUI 中心だった運用を、再現可能なコマンド手順に置き換え可能。
- profile と優先順位の明文化により、環境差異を抑えやすい。
- access code をファイル管理することで、フラグ直渡しより安全に運用しやすい。

## 確認済み事項と未検証事項

### ✅ 確認済み（出典あり）

- `bambu-cli` は MQTT/FTPS/camera 経由で BambuLab を制御。
- Homebrew インストールと主要コマンドは README に記載。
- 設定優先順位と必要ポートは README に記載。
- OpenClaw Showcase に “Bambu 3D Printer Control” が掲載。

### ⚠️ 未検証（ユーザーヒアリング・計測が必要）

- 1ジョブあたりの作業時間短縮率
- GUI 運用と比較した失敗率の変化
- 複数プリンタ運用時のスループット改善

## 実運用メモ

- access code はファイル保存 + `chmod 600` を推奨。
- 自動化前に MQTT/FTPS/camera ポート到達性を確認。
- 構成を明示し、マシン間ドリフトを減らす。

## 参考リンク

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [bambu-cli repository](https://github.com/tobiasbischoff/bambu-cli)
- [bambu-cli README](https://github.com/tobiasbischoff/bambu-cli/blob/master/README.md?raw=1)
