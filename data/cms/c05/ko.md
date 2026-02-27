---
title: "linear-cli + OpenClaw로 Linear 이슈에서 PR까지 연결하기"
description: "공개 문서를 근거로, 터미널 기반 Linear 이슈 처리부터 PR 연계까지 재사용 가능한 흐름을 만들고 OpenClaw와 함께 운영한다."
---

# C05 사용자 사례: linear-cli + OpenClaw로 Linear 이슈에서 PR까지 연결하기

## 개요

- **분류:** 자동화 / 개발자 워크플로우
- **대상:** Linear를 사용하며 터미널 중심 실행과 AI 협업을 함께 적용하려는 팀
- **출처:**
  - [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
  - [Finesssee/linear-cli](https://github.com/Finesssee/linear-cli)
  - [linear-cli examples](https://github.com/Finesssee/linear-cli/blob/master/docs/examples.md?raw=1)

## 배경

많은 팀에서 이슈 작업이 브라우저, 로컬 터미널, 채팅 도구로 분산되어 문맥 전환이 잦고 반복 작업이 표준화되기 어렵습니다.

이 사례는 문서로 확인 가능한 다음 흐름에 초점을 둡니다.

1. `linear-cli`로 이슈/깃 작업을 실행한다.
2. 기계가 읽기 쉬운 출력 형태를 유지한다.
3. OpenClaw에 문맥을 넘겨 후속 판단을 이어간다.

## 출처로 검증 가능한 기능

README, examples 문서, OpenClaw Showcase 기준:

1. `linear-cli`는 issues, projects, labels, teams, cycles, comments 등 폭넓은 명령을 제공한다.
2. 인증은 브라우저 OAuth와 API key 경로를 지원한다.
3. 이슈 워크플로우에는 start/stop/close 및 담당자 관련 작업이 포함된다.
4. Git 연동으로 이슈 기반 브랜치 체크아웃과 PR 생성이 가능하다 (`linear-cli g checkout`, `linear-cli g pr`).
5. JSON/NDJSON 출력이 문서화되어 스크립트/에이전트 연계에 적합하다.
6. OpenClaw Showcase에 Linear CLI가 커뮤니티 프로젝트로 소개되어 있다.

## 구현 경로

### 1) 설치 및 확인

```bash
cargo install linear-cli
linear-cli --help
```

### 2) 인증 설정

```bash
linear-cli auth oauth
# 또는
linear-cli config set-key lin_api_xxx
```

### 3) 터미널에서 이슈 흐름 실행

```bash
linear-cli i list --mine --output json --compact
linear-cli i start LIN-123 --checkout
linear-cli i comment LIN-123 -b "Work started from CLI workflow"
```

### 4) PR 연계 후 OpenClaw로 후속 진행

```bash
linear-cli g pr LIN-123 --draft
```

명령 결과를 OpenClaw 대화에 전달해 리뷰 체크리스트, 머지 준비, 다음 작업 조율을 이어간다.

## 결과(근거 기반)

- 이슈부터 PR까지의 흐름을 CLI에서 반복 실행할 수 있다.
- 구조화된 출력은 자동화와 AI 문맥 전달에 유리하다.
- 일상적인 작업에서 수동 UI 전환 의존도를 낮출 수 있다.

## 확인된 사실 vs 추가 검증 항목

### ✅ 확인된 사실

- Linear CLI는 이슈 운영, git 연동, 워크스페이스 관련 명령을 제공한다.
- OAuth/API key 인증 경로가 문서화되어 있다.
- JSON/NDJSON 출력 지원이 문서화되어 있다.
- Showcase에 Linear CLI가 등록되어 있다.

### ⚠️ 추가 검증 필요(팀 데이터 필요)

- 이슈 단위 평균 처리 시간 변화
- CLI 도입 후 리뷰 대기 시간 변화
- 다중 저장소 운영 시 장기 처리량 변화

## 실무 메모

- 팀 규칙에서 이슈 식별자(예: `LIN-123`) 표기를 통일한다.
- AI 연계 시에는 구조화 출력 형식을 우선 사용한다.
- 환경별 인증 방식을 명시해 워크스페이스 혼선을 줄인다.

## 참고 링크

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [linear-cli repository](https://github.com/Finesssee/linear-cli)
- [linear-cli examples](https://github.com/Finesssee/linear-cli/blob/master/docs/examples.md?raw=1)
