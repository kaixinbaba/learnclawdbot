---
title: "오프라인 AI: 완전한 프라이버시를 위해 Ollama로 OpenClaw 실행하기"
description: "Ollama와 로컬 모델로 OpenClaw를 완전히 오프라인으로 운영하세요. 데이터가 기기 밖으로 나가지 않으며 API 키도 필요 없습니다. 모델 선택, 성능 튜닝, 실용적인 활용 사례를 포함한 완전한 설정 가이드."
publishedAt: 2026-03-20
status: published
visibility: public
---

# 오프라인 AI: 완전한 프라이버시를 위해 Ollama로 OpenClaw 실행하기

클라우드 AI 서비스에 메시지를 전송하는 순간, 그 메시지는 내 기기를 떠납니다. CDN을 거치고, 서비스 제공자의 로그에 기록되며, 학습 데이터로 사용되거나 사람이 검토할 수도 있습니다. 일상적인 용도라면 감수할 수 있는 트레이드오프입니다. 하지만 독점 코드, 개인 데이터, 민감한 비즈니스 로직, 기밀 문서를 다룬다면 그렇지 않습니다.

제가 로컬 AI를 탐색하기 시작한 데는 명확한 이유가 있었습니다. PII(개인 식별 정보)가 포함된 고객 지원 티켓을 분석하는 데 AI 어시스턴트를 활용하고 싶었는데, 클라우드 API를 쓰면 실제 컴플라이언스 문제가 생길 수 있었습니다. 모든 것을 로컬에서 처리함으로써 문제를 깔끔하게 해결했습니다. 그 이후로 로컬 환경을 상당히 확장했고, 지금은 민감한 작업에 주 환경으로 사용하고 있습니다.

이 가이드는 Ollama를 모델 백엔드로 사용하여 OpenClaw를 완전히 오프라인으로 실행하는 방법을 다룹니다. 설정을 마치면 인터넷 연결 없이 작동하고, 모든 데이터를 로컬에서 처리하며, API 키가 전혀 필요 없는 AI 어시스턴트를 갖게 됩니다.

## 왜 Ollama인가

Ollama는 대형 언어 모델을 로컬에서 실행하는 가장 간단한 방법입니다. 모델 다운로드, GGUF 형식 변환, 하드웨어 가속 감지, 그리고 OpenAI 채팅 완성 사양과 호환되는 REST API를 모두 처리해 줍니다. 마지막 항목이 바로 특별한 통합 코드 없이 OpenClaw와 연동될 수 있는 핵심입니다.

다른 선택지도 있습니다. LM Studio, llama.cpp 직접 사용, LocalAI 등입니다. 하지만 Ollama는 단순함과 기능성 사이에서 가장 적절한 균형을 잡고 있습니다. 설치하고 모델을 pull하면 API가 바로 서빙됩니다. OpenClaw는 OpenAI에 연결하는 것과 동일한 방식으로 해당 API에 연결됩니다.

## 시스템 요구 사항

로컬 모델은 실제 연산 능력을 필요로 합니다. 사용 목적별 현실적인 최소 사양은 다음과 같습니다.

**기본 사용 (7B 파라미터 모델):**
- RAM: 8GB (GPU 없을 경우 모델 일부가 RAM에서 실행)
- GPU VRAM: GPU 가속을 위해 4GB
- 스토리지: 모델당 5~10GB

**원활한 성능 (13B 모델):**
- RAM: 16GB
- GPU VRAM: 8GB
- 스토리지: 모델당 8~15GB

**높은 품질 (30B 이상 모델):**
- RAM: 32GB 이상
- GPU VRAM: 16GB 이상 (또는 통합 메모리를 갖춘 Apple Silicon)
- 스토리지: 모델당 20~50GB

Apple Silicon Mac(M1/M2/M3/M4)은 통합 메모리를 갖추고 있어 로컬 모델 실행에 특히 유리합니다. 32GB 통합 메모리를 갖춘 MacBook Pro는 34B 모델을 여유롭게 실행합니다.

## Ollama 설치

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows: ollama.com에서 설치 파일 다운로드

# 설치 확인
ollama --version
```

Ollama 서비스를 시작합니다.

```bash
ollama serve
# macOS에서는 설치 후 메뉴 바 앱으로 자동 실행됩니다
```

## 모델 선택

모델 선택은 이 설정에서 가장 중요한 결정입니다. 클수록 좋은 게 아닙니다. GPU VRAM에 맞는 작은 모델이 RAM에서 실행되는 큰 모델보다 훨씬 빠를 수 있습니다.

**코딩 및 기술적 작업에 최적인 모델:**

```bash
# 코드 특화, 기술적 질문에 탁월
ollama pull codellama:13b

# Qwen2.5-Coder: 뛰어난 코드 이해력
ollama pull qwen2.5-coder:14b

# DeepSeek-Coder: 코드 자동완성에 강함
ollama pull deepseek-coder-v2:16b
```

**일반 글쓰기 및 분석에 최적인 모델:**

```bash
# Llama 3.1: 이 크기에서 최고의 범용 모델
ollama pull llama3.1:8b

# Mistral: 빠르고 7B 치고 좋은 품질
ollama pull mistral:7b

# Gemma 2: Google의 오픈 모델, 추론 능력이 우수
ollama pull gemma2:9b
```

**최고 품질을 위한 대형 모델:**

```bash
# Llama 3.1 70B (약 40GB RAM 또는 24GB 이상 VRAM 필요)
ollama pull llama3.1:70b

# Qwen2.5 32B (특정 작업에서 더 큰 모델보다 우수)
ollama pull qwen2.5:32b
```

OpenClaw에 연결하기 전에 모델을 테스트해 보세요.

```bash
ollama run mistral:7b "Explain what an MCP server is in one paragraph"
```

정상 작동하고 응답 품질이 만족스럽다면 연결할 준비가 된 것입니다.

## Ollama용 OpenClaw 설정

OpenClaw는 Ollama의 OpenAI 호환 API를 통해 연결됩니다. OpenClaw 설정 파일을 수정하세요.

```yaml
# ~/.openclaw/config.yaml

providers:
  - name: ollama-local
    type: openai-compatible
    baseUrl: "http://localhost:11434/v1"
    apiKey: "ollama"  # Ollama는 실제 키가 필요하지 않지만 필드는 있어야 함
    models:
      - id: mistral:7b
        name: "Mistral 7B (Local)"
        contextWindow: 32768
      - id: llama3.1:8b
        name: "Llama 3.1 8B (Local)"
        contextWindow: 131072
      - id: codellama:13b
        name: "CodeLlama 13B (Local)"
        contextWindow: 16384

defaultProvider: ollama-local
defaultModel: mistral:7b
```

OpenClaw를 재시작하고 연결을 확인합니다.

```bash
openclaw status
# 출력 예시: Provider: ollama-local, Model: mistral:7b
```

## 오프라인 동작 확인

설정 완료 후 인터넷 없이 모든 것이 작동하는지 확인하세요.

```bash
# 네트워크 비활성화 (macOS)
networksetup -setnetworkserviceenabled Wi-Fi off

# OpenClaw 테스트
openclaw chat "What is 15 * 37?"

# 네트워크 재활성화
networksetup -setnetworkserviceenabled Wi-Fi on
```

네트워크가 비활성화된 상태에서도 응답을 받아야 합니다. OpenClaw가 멈추거나 오류가 발생하면 Ollama가 여전히 서빙 중인지 확인하세요(모델을 다운로드한 후에는 Ollama에 인터넷이 필요하지 않으므로 정상 동작해야 합니다).

## 성능 튜닝

로컬 모델은 클라우드 API보다 느립니다. 속도에 실질적으로 영향을 미치는 요소들을 소개합니다.

**GPU 가속이 가장 큰 단일 요인입니다.** Ollama가 GPU를 사용하고 있는지 확인하세요.

```bash
ollama run mistral:7b "" --verbose
# 확인: "using GPU: NVIDIA GeForce..." 또는 "using Metal: Apple M..."
```

호환 GPU가 있는데 CPU에서만 실행된다면 적절한 드라이버를 설치하세요(NVIDIA는 CUDA, AMD는 ROCm). Apple Silicon macOS에서는 Metal 가속이 자동으로 적용됩니다.

**CPU 폴백 시 병렬 스레드 수:**

```bash
# Ollama 환경 변수 (Linux에서는 /etc/ollama/ollama.conf 파일 생성)
OLLAMA_NUM_PARALLEL=4
OLLAMA_MAX_LOADED_MODELS=1
```

**컨텍스트 크기는 속도에 큰 영향을 미칩니다.** 7B 모델에서 128K 토큰 컨텍스트 윈도우는 8K 컨텍스트보다 느립니다. 긴 컨텍스트가 필요 없다면 명시적으로 설정하세요.

```yaml
# OpenClaw 설정
providers:
  - name: ollama-local
    models:
      - id: mistral:7b
        contextWindow: 8192  # 컨텍스트를 줄이면 응답 속도가 빨라짐
```

**모델을 로드된 상태로 유지하세요.** Ollama는 타임아웃 후 모델을 언로드합니다. 개발 중에는 항상 웜(warm) 상태를 유지하세요.

```bash
# 몇 분마다 no-op 요청을 보내 모델을 로드 상태로 유지
while true; do
  curl -s http://localhost:11434/api/generate \
    -d '{"model":"mistral:7b","prompt":"","keep_alive":"10m"}' > /dev/null
  sleep 300
done
```

## 실용적인 활용 사례

**독점 코드베이스 코드 리뷰:**

```bash
cd /path/to/private-project
openclaw chat "Review this file for security issues" --files src/auth/jwt.ts
```

데이터가 기기 밖으로 나가지 않습니다. 코드 분석 전체가 로컬에서 이루어집니다.

**민감한 문서 분석:**

```bash
openclaw chat "Summarize the key obligations in this contract" --files contract.pdf
```

PDF, 텍스트 파일, 코드 파일 등 OpenClaw의 파일 처리가 지원하는 모든 형식에 적용됩니다.

**인터넷 차단 환경에서의 실행:**

인터넷 접근이 없는 프로덕션 환경도 존재합니다. Ollama와 OpenClaw를 설치하고 모델을 다운로드하면, 에어갭(air-gapped) 환경에서도 전체 스택이 작동합니다.

**로컬 지식 베이스 검색:**

OpenClaw의 컨텍스트 로딩과 결합해 사용하세요.

```bash
openclaw chat --context /path/to/internal/docs "How does our payment integration work?"
```

모델이 로컬 문서만을 사용해서 답변합니다.

## 멀티 모델 설정

작업에 따라 최적의 모델이 다릅니다. OpenClaw는 대화 중간에 모델을 전환하는 것을 지원합니다.

```yaml
# ~/.openclaw/config.yaml
providers:
  - name: ollama-local
    type: openai-compatible
    baseUrl: "http://localhost:11434/v1"
    apiKey: "ollama"
    models:
      - id: mistral:7b
        name: "Fast (Mistral 7B)"
      - id: codellama:13b
        name: "Code (CodeLlama 13B)"
      - id: llama3.1:70b
        name: "Quality (Llama 3.1 70B)"
```

실제로 저는 빠른 질문과 반복 작업에는 Mistral 7B, 기술적 분석에는 CodeLlama, 시간이 걸려도 괜찮은 복잡한 추론 작업에는 Llama 70B를 사용합니다.

## 클라우드 대 로컬 품질 비교

솔직한 평가를 하자면, 최고의 로컬 모델(70B 이상)은 복잡한 작업에서 최고의 클라우드 모델(GPT-4o, Claude 3.5 Sonnet)에 근접하지만 동등하지는 않습니다. 그 격차는 2025년에 상당히 줄었습니다. 대부분의 실용적인 작업에서는:

- **코딩 지원**: 로컬 13B 이상 모델이 매우 우수합니다. 가장 복잡한 리팩토링에서만 클라우드가 근소하게 앞섭니다.
- **텍스트 요약**: 로컬 모델이 탁월합니다. 8B 이상에서는 품질 차이가 거의 없습니다.
- **창의적 글쓰기**: 클라우드 모델이 아직 앞서 있지만, 로컬 70B도 실용적으로 사용 가능합니다.
- **추론 및 분석**: 새로운 복잡한 문제에는 클라우드가 더 낫습니다. 확립된 패턴에는 로컬로 충분합니다.

프라이버시에 민감한 작업에서는 이러한 품질 트레이드오프가 대개 감수할 만합니다. 민감하지 않은 작업에서 최고 품질을 원한다면 클라우드 API가 여전히 더 나은 선택입니다.

## 자주 묻는 질문

**Ollama 모델에서 OpenClaw의 툴 사용 및 MCP 기능을 쓸 수 있나요?**

대부분의 Ollama 모델은 함수 호출 / 툴 사용을 지원합니다. 호환성은 모델에 따라 다릅니다. CodeLlama, Llama 3.1, Mistral은 잘 지원합니다. Ollama 웹사이트에서 해당 모델의 문서를 확인하세요. 로컬 모델에서 MCP 서버를 사용할 때는 모델이 툴을 올바르게 호출하는지 테스트하세요. 일부 소형 모델은 복잡한 툴 스키마를 처리하는 데 어려움을 겪습니다.

**Ollama 모델은 어떻게 업데이트하나요?**

```bash
ollama pull mistral:7b  # 다시 pull하면 최신 버전을 가져옴
ollama list             # 다운로드된 모델 목록 확인
ollama rm mistral:7b    # 공간 확보를 위해 모델 제거
```

**여러 모델을 동시에 실행할 수 있나요?**

네, 하지만 로드된 각 모델이 메모리를 점유합니다. 32GB 시스템에서는 보통 7B 모델 두 개를 동시에 실행할 수 있습니다. Ollama 환경에서 `OLLAMA_MAX_LOADED_MODELS=2`를 설정하세요.

**로컬 모델에서 OpenClaw의 메모리 및 세션 지속성이 작동하나요?**

네. OpenClaw의 세션 관리는 모델 백엔드와 독립적입니다. 로컬 세션, 컨텍스트 로딩, 대화 기록 모두 Ollama에서도 동일하게 작동합니다.

**양자화 관련해서, Q4와 Q8 중 어떤 것을 써야 하나요?**

Ollama는 기본적으로 Q4_K_M 양자화를 사용하며, 이는 좋은 균형점입니다. Q8은 더 높은 메모리 사용량을 대가로 더 좋은 품질을 제공합니다. 7B 모델 기준: Q4는 약 4GB VRAM, Q8은 약 8GB를 사용합니다. VRAM이 충분하다면 Q8을 권장합니다. pull 시 양자화를 지정할 수 있습니다.

```bash
ollama pull mistral:7b-instruct-q8_0
```

여기서 설명한 오프라인 AI 설정은 민감한 작업을 위한 저의 표준 환경이 되었습니다. 품질이 충분히 높아서 프라이버시에 민감한 작업에서 클라우드 API로 전환할 필요를 거의 느끼지 못하며, 프라이버시 보장은 완벽합니다. 데이터는 절대, 어떠한 경우에도 기기 밖으로 나가지 않습니다.
