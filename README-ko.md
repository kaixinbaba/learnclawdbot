# LearnClawdBot.org 🤖📚

[🇺🇸 English](./README.md) | [🇨🇳 中文](./README-zh.md) | [🇯🇵 日本語](./README-ja.md)

**[OpenClaw](https://github.com/openclaw/openclaw)의 가장 포괄적인 다국어 문서 사이트** — 오픈소스 AI 어시스턴트 프레임워크.

🌐 **사이트:** [https://learnclawdbot.org](https://learnclawdbot.org)

---

## ✨ 이것은 무엇인가요?

LearnClawdBot.org는 OpenClaw(구 Moltbot/Clawdbot)의 **비공식 커뮤니티 주도** 문서 및 튜토리얼 사이트입니다. 다음을 제공합니다:

- 📖 **264개 이상의 문서 페이지** — OpenClaw의 모든 측면을 다룹니다
- 🌍 **4개 언어 지원** — 영어, 중국어, 일본어, 한국어
- 🔧 **단계별 튜토리얼** — 설치부터 고급 사용법까지
- 💡 **실전 예제**와 모범 사례
- 📝 **블로그 글** — 팁, 통합 방법, 사용 사례

## 🌍 언어 지원 현황

| 언어 | 문서 수 | 상태 |
|------|---------|------|
| 🇺🇸 English | 264페이지 | ✅ 완료 |
| 🇨🇳 中文 | 264페이지 | ✅ 완료 |
| 🇯🇵 日本語 | 264페이지 | ✅ 완료 |
| 🇰🇷 한국어 | 260페이지 | 🔄 98% 완료 |

## 📚 문서 구조

```
docs/
├── en/          # 영어 (원본)
├── zh/          # 중국어
├── ja/          # 일본어
├── ko/          # 한국어
│
├── channels/    # Telegram, Discord, WhatsApp, Signal, Slack, LINE...
├── cli/         # CLI 레퍼런스 (41개 명령어)
├── concepts/    # 아키텍처, 에이전트, 세션, 모델...
├── gateway/     # 설정, 보안, 원격 접속...
├── install/     # npm, Docker, Nix, Bun...
├── nodes/       # 모바일 노드, 카메라, 오디오, 위치...
├── platforms/   # macOS, Linux, Windows, Raspberry Pi, 클라우드...
├── plugins/     # 음성 통화, 에이전트 도구, 매니페스트...
├── providers/   # Anthropic, OpenAI, Ollama, DeepSeek, Gemini...
├── start/       # 빠른 시작 가이드
├── tools/       # 브라우저 자동화, 코드 실행, 스킬, 서브에이전트...
└── web/         # 대시보드, 웹챗, 컨트롤 UI...
```

## 🛠️ 기술 스택

- **프레임워크:** [Next.js](https://nextjs.org/) (App Router)
- **문서 엔진:** [Fumadocs](https://fumadocs.vercel.app/)
- **스타일링:** Tailwind CSS
- **i18n:** next-intl (4개 로케일)
- **배포:** Vercel
- **콘텐츠:** MDX 기반

## 🚀 시작하기

### 사전 요구사항

- Node.js 18+
- pnpm (권장) 또는 npm

### 설치

```bash
git clone https://github.com/kaixinbaba/learnclawdbot.git
cd learnclawdbot
pnpm install
pnpm dev
```

[http://localhost:3000](http://localhost:3000)을 열어 사이트를 확인하세요.

### 빌드

```bash
pnpm build
```

## 🤝 기여하기

기여를 환영합니다! 다음과 같은 방법으로 참여할 수 있습니다:

- **🌍 번역 개선** — 번역 품질 수정 또는 누락된 페이지 추가
- **📝 콘텐츠 업데이트** — 최신 OpenClaw 릴리스와 문서 동기화
- **🐛 버그 수정** — 사이트 문제 보고 및 수정
- **✨ 새 튜토리얼** — OpenClaw 사용 사례에 대한 블로그 글 작성

### 번역 가이드

1. `docs/en/`의 영문 문서가 원본입니다
2. 번역 문서는 `docs/{locale}/`에 동일한 파일 구조로 배치합니다
3. MDX 구조를 동일하게 유지합니다 — 텍스트 콘텐츠만 번역
4. 코드 블록, 인라인 코드, 기술 용어는 영문 그대로 유지

## 📊 OpenClaw 다루는 내용

- **19개 채널 통합** — Telegram, Discord, WhatsApp, Signal, Slack, LINE, Matrix, Twitch 등
- **19개 AI 프로바이더** — Anthropic, OpenAI, Ollama, DeepSeek, Gemini, Qwen 등
- **14개 플랫폼 가이드** — macOS, Linux, Windows, Docker, Raspberry Pi, 클라우드
- **22개 도구 레퍼런스** — 브라우저 자동화, 코드 실행, 스킬, 서브에이전트
- **30개 개념 설명** — 에이전트 아키텍처, 세션, 모델 페일오버, 컨텍스트 관리

## 📄 라이선스

이 프로젝트는 오픈소스입니다. 문서 콘텐츠는 교육 목적으로 제공됩니다.

## 🔗 링크

- 🌐 **웹사이트:** [learnclawdbot.org](https://learnclawdbot.org)
- 🤖 **OpenClaw:** [github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)
- 📖 **공식 문서:** [docs.openclaw.ai](https://docs.openclaw.ai)
- 💬 **커뮤니티:** [OpenClaw Discord](https://discord.com/invite/clawd)

---

*OpenClaw 커뮤니티가 ❤️으로 제작*
