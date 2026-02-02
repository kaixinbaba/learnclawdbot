# LearnClawdBot.org 🤖📚

[🇺🇸 English](./README.md) | [🇨🇳 中文](./README-zh.md) | [🇰🇷 한국어](./README-ko.md)

**[OpenClaw](https://github.com/openclaw/openclaw) の最も包括的な多言語ドキュメントサイト** — オープンソースAIアシスタントフレームワーク。

🌐 **サイト：** [https://learnclawdbot.org](https://learnclawdbot.org)

---

## ✨ これは何ですか？

LearnClawdBot.org は、OpenClaw（旧 Moltbot/Clawdbot）の**非公式・コミュニティ主導**のドキュメント＆チュートリアルサイトです。以下を提供しています：

- 📖 **264以上のドキュメントページ** — OpenClawのあらゆる側面をカバー
- 🌍 **4言語対応** — 英語、中国語、日本語、韓国語
- 🔧 **ステップバイステップのチュートリアル** — セットアップから高度な使い方まで
- 💡 **実践的な例**とベストプラクティス
- 📝 **ブログ記事** — ヒント、インテグレーション、ユースケース

## 🌍 言語カバレッジ

| 言語 | ドキュメント数 | ステータス |
|------|--------------|-----------|
| 🇺🇸 English | 264ページ | ✅ 完了 |
| 🇨🇳 中文 | 264ページ | ✅ 完了 |
| 🇯🇵 日本語 | 264ページ | ✅ 完了 |
| 🇰🇷 한국어 | 260ページ | 🔄 98% 完了 |

## 📚 ドキュメント構成

```
docs/
├── en/          # 英語（ソース）
├── zh/          # 中国語
├── ja/          # 日本語
├── ko/          # 韓国語
│
├── channels/    # Telegram、Discord、WhatsApp、Signal、Slack、LINE...
├── cli/         # CLIリファレンス（41コマンド）
├── concepts/    # アーキテクチャ、エージェント、セッション、モデル...
├── gateway/     # 設定、セキュリティ、リモートアクセス...
├── install/     # npm、Docker、Nix、Bun...
├── nodes/       # モバイルノード、カメラ、オーディオ、位置情報...
├── platforms/   # macOS、Linux、Windows、Raspberry Pi、クラウド...
├── plugins/     # 音声通話、エージェントツール、マニフェスト...
├── providers/   # Anthropic、OpenAI、Ollama、DeepSeek、Gemini...
├── start/       # クイックスタートガイド
├── tools/       # ブラウザ自動化、コード実行、スキル、サブエージェント...
└── web/         # ダッシュボード、ウェブチャット、コントロールUI...
```

## 🛠️ 技術スタック

- **フレームワーク：** [Next.js](https://nextjs.org/)（App Router）
- **ドキュメントエンジン：** [Fumadocs](https://fumadocs.vercel.app/)
- **スタイリング：** Tailwind CSS
- **i18n：** next-intl（4ロケール）
- **デプロイ：** Vercel
- **コンテンツ：** MDXベース

## 🚀 はじめに

### 前提条件

- Node.js 18+
- pnpm（推奨）または npm

### インストール

```bash
git clone https://github.com/kaixinbaba/learnclawdbot.git
cd learnclawdbot
pnpm install
pnpm dev
```

[http://localhost:3000](http://localhost:3000) を開いてサイトを確認できます。

### ビルド

```bash
pnpm build
```

## 🤝 コントリビューション

コントリビューションを歓迎します！以下の方法で参加できます：

- **🌍 翻訳の改善** — 翻訳品質の修正や不足ページの追加
- **📝 コンテンツの更新** — 最新のOpenClawリリースとドキュメントを同期
- **🐛 バグ修正** — サイトの問題を報告・修正
- **✨ 新しいチュートリアル** — OpenClawのユースケースに関するブログ記事を執筆

### 翻訳ガイド

1. `docs/en/` の英語ドキュメントがソースです
2. 翻訳は `docs/{locale}/` に同じファイル構造で配置します
3. MDX構造は同一に保ちます — テキストコンテンツのみ翻訳
4. コードブロック、インラインコード、技術用語は英語のまま保持

## 📊 OpenClaw カバー範囲

- **19のチャネル連携** — Telegram、Discord、WhatsApp、Signal、Slack、LINE、Matrix、Twitch など
- **19のAIプロバイダー** — Anthropic、OpenAI、Ollama、DeepSeek、Gemini、Qwen など
- **14のプラットフォームガイド** — macOS、Linux、Windows、Docker、Raspberry Pi、クラウド
- **22のツールリファレンス** — ブラウザ自動化、コード実行、スキル、サブエージェント
- **30のコンセプト解説** — エージェントアーキテクチャ、セッション、モデルフェイルオーバー、コンテキスト管理

## 📄 ライセンス

本プロジェクトはオープンソースです。ドキュメントコンテンツは教育目的で提供されています。

## 🔗 リンク

- 🌐 **ウェブサイト：** [learnclawdbot.org](https://learnclawdbot.org)
- 🤖 **OpenClaw：** [github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)
- 📖 **公式ドキュメント：** [docs.openclaw.ai](https://docs.openclaw.ai)
- 💬 **コミュニティ：** [OpenClaw Discord](https://discord.com/invite/clawd)

---

*OpenClawコミュニティが ❤️ で構築*
