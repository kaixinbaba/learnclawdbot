---
title: "Offline AI: Running OpenClaw with Ollama for Complete Privacy"
description: "Run OpenClaw entirely offline using Ollama and local models. No data leaves your machine, no API keys required. Complete setup guide with model selection, performance tuning, and practical use cases."
publishedAt: 2026-03-20
status: published
visibility: public
---

# Offline AI: Running OpenClaw with Ollama for Complete Privacy

The moment you send a message to any cloud AI service, that message leaves your machine. It passes through CDNs, gets logged by the provider, and may be used for training or reviewed by humans. For most casual use cases, that's an acceptable trade-off. For everything else — proprietary code, personal data, sensitive business logic, confidential documents — it isn't.

I started exploring local AI for a specific reason: I wanted to use an AI assistant to analyze customer support tickets that contained PII. Using a cloud API for that would have created real compliance problems. Running everything locally solved the problem cleanly. Since then I've expanded my local setup considerably and now use it as my primary environment for anything sensitive.

This guide covers running OpenClaw entirely offline using Ollama as the model backend. When it's done, you'll have an AI assistant that works without an internet connection, processes all your data locally, and requires no API keys.

## Why Ollama

Ollama is the simplest way to run large language models locally. It handles model downloads, GGUF format conversion, hardware acceleration detection, and a REST API that's compatible with the OpenAI chat completions spec. That last point is what makes it work with OpenClaw without any special integration code.

Other options exist — LM Studio, llama.cpp directly, LocalAI — but Ollama hits the right balance of simplicity and capability. You install it, pull a model, and it serves an API. OpenClaw connects to that API the same way it connects to OpenAI.

## System Requirements

Local models require real compute. Realistic minimums by use case:

**Basic use (7B parameter models):**
- RAM: 8GB (model runs partially in RAM if no GPU)
- GPU VRAM: 4GB for GPU acceleration
- Storage: 5-10GB per model

**Good performance (13B models):**
- RAM: 16GB
- GPU VRAM: 8GB
- Storage: 8-15GB per model

**High quality (30B+ models):**
- RAM: 32GB+
- GPU VRAM: 16GB+ (or Apple Silicon with unified memory)
- Storage: 20-50GB per model

Apple Silicon Macs (M1/M2/M3/M4) have unified memory and handle local models particularly well. A MacBook Pro with 32GB unified memory runs 34B models comfortably.

## Installing Ollama

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows: download installer from ollama.com

# Verify installation
ollama --version
```

Start the Ollama service:

```bash
ollama serve
# Or on macOS, it runs as a menu bar app after installation
```

## Choosing a Model

Model selection is the most consequential decision in this setup. Bigger isn't always better — a smaller model that fits in GPU VRAM will outperform a larger model running in RAM by a significant margin.

**Best models for coding and technical tasks:**

```bash
# Code-specialized, excellent for technical questions
ollama pull codellama:13b

# Qwen2.5-Coder: excellent code understanding
ollama pull qwen2.5-coder:14b

# DeepSeek-Coder: strong on code completion
ollama pull deepseek-coder-v2:16b
```

**Best models for general writing and analysis:**

```bash
# Llama 3.1: best general-purpose at this size
ollama pull llama3.1:8b

# Mistral: fast, good quality at 7B
ollama pull mistral:7b

# Gemma 2: Google's open model, good reasoning
ollama pull gemma2:9b
```

**Largest models for best quality:**

```bash
# Llama 3.1 70B (requires ~40GB RAM or 24GB+ VRAM)
ollama pull llama3.1:70b

# Qwen2.5 32B (better than many larger models at specific tasks)
ollama pull qwen2.5:32b
```

Test a model before connecting OpenClaw:

```bash
ollama run mistral:7b "Explain what an MCP server is in one paragraph"
```

If that works and the response quality is acceptable, you're ready to connect.

## Configuring OpenClaw for Ollama

OpenClaw connects to Ollama through its OpenAI-compatible API. Edit your OpenClaw configuration:

```yaml
# ~/.openclaw/config.yaml

providers:
  - name: ollama-local
    type: openai-compatible
    baseUrl: "http://localhost:11434/v1"
    apiKey: "ollama"  # Ollama doesn't require a real key, but field must be present
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

Restart OpenClaw and verify it connects:

```bash
openclaw status
# Should show: Provider: ollama-local, Model: mistral:7b
```

## Verifying Offline Operation

Once configured, verify that everything works without internet access:

```bash
# Disable network (macOS)
networksetup -setnetworkserviceenabled Wi-Fi off

# Test OpenClaw
openclaw chat "What is 15 * 37?"

# Re-enable network
networksetup -setnetworkserviceenabled Wi-Fi on
```

You should get a response even with the network disabled. If OpenClaw hangs or errors, check that Ollama is still serving (it should be — Ollama doesn't require internet after the model is downloaded).

## Performance Tuning

Local models are slower than cloud APIs. Here's what actually matters for speed:

**GPU acceleration is the single biggest factor.** Verify Ollama is using your GPU:

```bash
ollama run mistral:7b "" --verbose
# Look for: "using GPU: NVIDIA GeForce..." or "using Metal: Apple M..."
```

If it's running on CPU only with a compatible GPU present, install the appropriate drivers (CUDA for NVIDIA, ROCm for AMD). On macOS with Apple Silicon, Metal acceleration is automatic.

**Num parallel threads for CPU fallback:**

```bash
# In Ollama's environment (create /etc/ollama/ollama.conf on Linux)
OLLAMA_NUM_PARALLEL=4
OLLAMA_MAX_LOADED_MODELS=1
```

**Context size affects speed significantly.** A context window of 128K tokens on a 7B model is slower than 8K context. If you don't need long context, configure it explicitly:

```yaml
# In OpenClaw config
providers:
  - name: ollama-local
    models:
      - id: mistral:7b
        contextWindow: 8192  # Smaller context = faster responses
```

**Keep the model loaded.** Ollama unloads models after a timeout. For development, keep it warm:

```bash
# Keep model loaded by running a no-op request every few minutes
while true; do
  curl -s http://localhost:11434/api/generate \
    -d '{"model":"mistral:7b","prompt":"","keep_alive":"10m"}' > /dev/null
  sleep 300
done
```

## Practical Use Cases

**Code review on proprietary codebase:**

```bash
cd /path/to/private-project
openclaw chat "Review this file for security issues" --files src/auth/jwt.ts
```

Nothing leaves your machine. The entire code analysis happens locally.

**Analyzing sensitive documents:**

```bash
openclaw chat "Summarize the key obligations in this contract" --files contract.pdf
```

Works with PDFs, text files, code files — any format OpenClaw's file handling supports.

**Running on a disconnected system:**

Some production environments have no internet access. Once Ollama and OpenClaw are installed and models are downloaded, the entire stack works in an air-gapped environment.

**Local knowledge base search:**

Combine with OpenClaw's context loading:

```bash
openclaw chat --context /path/to/internal/docs "How does our payment integration work?"
```

The model answers using only your local documentation.

## Multi-Model Setup

Different tasks benefit from different models. OpenClaw supports switching between models mid-conversation:

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

In practice I use Mistral 7B for quick questions and iteration, CodeLlama for technical analysis, and Llama 70B for complex reasoning tasks where I don't mind waiting longer.

## Comparing Cloud vs Local Quality

Honest assessment: the best local models (70B+) are close to but not equal to the best cloud models (GPT-4o, Claude 3.5 Sonnet) for complex tasks. The gap has closed significantly in 2025. For most practical tasks:

- **Coding assistance**: Local 13B+ models are very good. Minor edge to cloud for the most complex refactoring.
- **Text summarization**: Local models excellent. Minimal quality difference at 8B+.
- **Creative writing**: Cloud models still ahead, but local 70B is serviceable.
- **Reasoning/analysis**: Cloud models better for novel complex problems. Local fine for established patterns.

For privacy-sensitive work, that quality trade-off is usually worth it. For maximum quality on non-sensitive work, cloud APIs remain the better choice.

## FAQ

**Can I use Ollama models with OpenClaw's tool use and MCP features?**

Most Ollama models support function calling / tool use. Compatibility varies by model. CodeLlama, Llama 3.1, and Mistral support it well. Check the model's documentation on Ollama's website. When using MCP servers with local models, test that the model correctly invokes tools — some smaller models struggle with complex tool schemas.

**How do I update Ollama models?**

```bash
ollama pull mistral:7b  # Re-pulling fetches the latest version
ollama list             # See all downloaded models
ollama rm mistral:7b    # Remove a model to free space
```

**Can I run multiple models simultaneously?**

Yes, but each loaded model occupies memory. On a 32GB system, you can typically run two 7B models simultaneously. Configure `OLLAMA_MAX_LOADED_MODELS=2` in Ollama's environment.

**Does OpenClaw's memory/session persistence work with local models?**

Yes. OpenClaw's session management is independent of the model backend. Local sessions, context loading, and conversation history all work identically with Ollama.

**What about quantization — should I use Q4 or Q8?**

Ollama defaults to Q4_K_M quantization, which is a good balance. Q8 gives better quality at the cost of higher memory usage. For a 7B model: Q4 uses ~4GB VRAM, Q8 uses ~8GB. If you have the VRAM, Q8 is worth it. Specify quantization when pulling:

```bash
ollama pull mistral:7b-instruct-q8_0
```

The offline AI setup I've described here has become my standard environment for sensitive work. The quality is good enough that I rarely feel the need to switch to cloud APIs for privacy-sensitive tasks, and the privacy guarantee is complete — no data leaves the machine, ever.
