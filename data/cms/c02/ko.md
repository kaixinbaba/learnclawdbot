---
title: "padel-cli + OpenClaw로 코트 예약 자동화"
description: "코트를 자주 예약하는 사용자가 padel-cli와 OpenClaw 플러그인 흐름으로 수동 확인을 줄이고 예약 운영을 표준화한 사례입니다."
---

# C02 사용자 사례: padel-cli + OpenClaw로 코트 예약 자동화

## 사례 개요

- **카테고리:** 자동화 / 플러그인 워크플로
- **대상:** Playtomic 코트 조회·예약을 반복 수행하는 사용자
- **출처:**
  - [OpenClaw Docs: Showcase](https://docs.openclaw.ai/start/showcase)
  - [joshp123/padel-cli](https://github.com/joshp123/padel-cli)

## 배경

저녁 인기 시간대를 자주 노리는 사용자는 매일 반복적인 수동 조회에 시간을 쓰고 있었습니다. 기존 방식은 다음과 같습니다.

- 앱 실행
- 위치/날짜/시간대 검색
- 같은 작업을 매일 반복

목표는 이 과정을 OpenClaw에 연결 가능한 “스크립트 기반 재사용 흐름”으로 바꾸는 것이었습니다.

## 출처로 확인된 기능

저장소와 Showcase 기준으로 padel-cli는 다음을 제공합니다.

1. 가용 시간 조회 및 검색 명령
2. 인증 기반 예약 명령
3. 반복 운영을 위한 venue alias 관리
4. 자동화 파이프라인에 유리한 `--json` 출력
5. nix-openclaw 연계를 위한 `openclawPlugin` flake output

## 적용 경로

### 1) CLI 빌드 및 기본 검색 확인

```bash
go build -o padel
padel clubs --near "Madrid"
padel search --location "Barcelona" --date 2025-01-05 --time 18:00-22:00
```

### 2) 인증 및 예약 경로 구성

```bash
padel auth login --email you@example.com --password yourpass
padel auth status
padel book --venue myclub --date 2025-01-05 --time 10:30 --duration 90
```

### 3) Venue alias로 반복 작업 안정화

```bash
padel venues add --id "<playtomic-id>" --alias myclub --name "My Club" --indoor --timezone "Europe/Madrid"
padel venues list
padel search --venues myclub --date 2025-01-05 --time 09:00-11:00
```

### 4) OpenClaw 플러그인 워크플로에 연결

README에는 `openclawPlugin` flake output이 명시되어 있습니다. nix-openclaw 환경에서는 플러그인 패키지가 `PATH`에 추가되고, skills는 워크스페이스 디렉터리에 심볼릭 링크됩니다.

## 결과 (근거 기반)

- 수동 앱 조작 중심에서 스크립트 실행 중심으로 전환 가능
- 검색/가용성 확인/예약을 재사용 가능한 단계로 조합 가능
- JSON 출력과 alias로 반복 실행 안정성 향상

## 확인된 사실 vs 추가 검증 항목

### ✅ 확인된 사실

- padel-cli는 `search`, `availability`, `auth`, `book`, `venues` 명령을 제공
- padel-cli는 JSON 출력을 지원
- `openclawPlugin` flake output이 문서화되어 있음
- OpenClaw Showcase에 "Padel Court Booking" 항목으로 소개됨

### ⚠️ 추가 검증 필요

- 사용자별 주간 절감 시간
- 도시/클럽별 예약 성공률 상승 폭
- 피크 시간대 장기 확보율 변화

## 운영 팁

- 자격 증명/설정은 `~/.config/padel` 같은 보호된 로컬 경로에 관리
- 자동화 실행 전 타임존 및 venue alias 매핑 점검
- 오예약 방지를 위해 핵심 예약 동작에 확인 단계 유지

## 참고 링크

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [padel-cli README](https://github.com/joshp123/padel-cli)
