---
title: Clawdia Phone Bridge - Vapi と OpenClaw で音声 AI アシスタントを構築
description: Vapi 音声アシスタントを OpenClaw に HTTP ブリッジ経由で接続しリアルタイム音声 AI アシスタントを構築する方法を学びましょう。電話で AI エージェントと通話できます。
slug: /clawdia-phone-bridge
tags: voice, vapi, bridge, phone, ai-assistant
publishedAt: 2026-03-05
status: published
visibility: public
featuredImageUrl: /images/features/clawdia-phone-bridge.webp
---

# Clawdia Phone Bridge - Vapi と OpenClaw で音声 AI アシスタントを構築

AI アシスタントに電話をかけたいと思ったことはありませんか？**Clawdia Phone Bridge**を使用すれば、それができます。このプロジェクトは、Vapi 音声 AI と OpenClaw の間のリアルタイム音声ブリッジを作成し телефонでのほぼリアルタイムの音声会話が可能になります。

## Clawdia Phone Bridge とは？

[Clawdia Phone Bridge](https://github.com/alejandroOPI/clawdia-bridge) は、Vapi（音声アシスタントプラットフォーム）を OpenClaw に接続する HTTP ブリッジです。以下が可能になります：

- AI アシスタントに電話をかける
- リアルタイムで音声応答を受け取る
- 音声で全ての OpenClaw スキル（カレンダー、メール、天気など）にアクセス

## 動作原理

アーキテクチャはシンプルに設計されています：

1. **あなた** が電話をかける
2. **Vapi** が音声をキャプチャしてブリッジに送信
3. **Clawdia Bridge** が WebSocket で OpenClaw にリクエストを転送
4. **OpenClaw** が AI エージェントを使用してリクエストを処理
5. **レスポンス** がブリッジ経由で Vapi に返される
6. **Vapi** が音声でレスポンスを読み上げる

```
あなた（電話）
    ↓
Clawdia（Vapi 音声 AI）
    ↓ POST /ask（ツール呼び出し）
Clawdia Bridge
    ↓ Gateway へ WebSocket
Clawdius（リクエスト処理）
    ↓ レスポンスを返す
Clawdia Bridge
    ↓ Vapi に返す
Clawdia
    ↓ 音声で話す
あなた
```

## クイックスタート

### 前提条件

- Node.js がインストール済み
- Vapi アカウント
- OpenClaw Gateway が起動中

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/alejandroOPI/clawdia-bridge.git
cd clawdia-bridge

# 依存関係をインストール
npm install

# ブリッジを起動
npm start
```

### 環境変数

| 変数 | デフォルト | 説明 |
|------|----------|------|
| BRIDGE_PORT | 3847 | リスニングポート |
| GATEWAY_URL | ws://127.0.0.1:18789 | OpenClaw Gateway WebSocket URL |

### Vapi 設定

1. **アシスタントを作成**：Vapi ダッシュボードで「Clawdia」というアシスタントを作成
2. **音声を設定**：女性の音声を選択（Vapi の Lily など）
3. **ツールを追加**：`ask_clawdius` 関数ツールを追加
4. **電話番号を割り当て**：Vapi の電話番号を接続

### インターネットに公開

本番環境では：

```bash
# Tailscale Funnel を使用（推奨）
npm start
tailscale funnel 3847

# または ngrok を使用
npm start
ngrok http 3844
```

## API エンドポイント

### POST /ask

Vapi が OpenClaw と通信するために呼び出すメインエンドポイント：

```json
{
  "question": "今日の天気は？"
}
```

レスポンス：

```json
{
  "answer": "現在晴れていて、気温は 22°C です。"
}
```

### GET /health

ヘルスチェックエンドポイント：

```json
{
  "status": "ok",
  "mode": "gateway-ws"
}
```

## なぜ重要か

このブリッジは無限の可能性を開きます：

- **音声ファーストワークフロー**：hands-free で AI と対話
- **電話ベースの AI エージェント**：通常の電話から呼び出せる AI アシスタントを作成
- **アクセシビリティ**：IT に詳しくないユーザーでも AI  помощник を利用可能
- **ビジネス応用**：カスタマーサポート、予約、情報検索

## ユースケース

- **パーソナル AI アシスタント**：AI に電話してカレンダー、天気、メールを確認
- **ビジネスホットライン**：電話による AI 駆動のカスタマーサポート
- **高齢者支援**：シンプルな音声インターフェースで AI にアクセス
- **手が塞がった時の生産性**：運転中や料理中にタスクを完了

## 結論

Clawdia Phone Bridge は、音声 AI と OpenClaw のエージェント機能を組み合わせた強力なデモンストレーションです。Vapi と OpenClaw をブリッジすることで、すべての OpenClaw スキルと統合を活用した高度な音声 AI アアシスタントを作成できます。

音声 AI の構築準備はできましたか？完全なドキュメントは [GitHub リポジトリ](https://github.com/alejandroOPI/clawdia-bridge) をご覧ください。
