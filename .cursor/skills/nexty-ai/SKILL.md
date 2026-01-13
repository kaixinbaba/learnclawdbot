---
name: nexty-ai
description: Integrate AI providers in NEXTY.DEV using ai-sdk. Use when adding chat, text generation, image generation, or other AI features. Covers multiple providers (OpenAI, Anthropic, Google, etc.) and streaming patterns.
---

# AI Integration in NEXTY.DEV

## Overview

- **SDK**: `ai` and `@ai-sdk/*` packages
- **Providers**: OpenAI, Anthropic, Google, DeepSeek, XAI, OpenRouter, Replicate
- **API Routes**: `app/api/ai-demo/`
- **UI Components**: `components/ai-demo/`

## Supported Providers

| Provider | Package | Env Variable |
|----------|---------|--------------|
| OpenAI | `@ai-sdk/openai` | `OPENAI_API_KEY` |
| Anthropic | `@ai-sdk/anthropic` | `ANTHROPIC_API_KEY` |
| Google | `@ai-sdk/google` | `GOOGLE_GENERATIVE_AI_API_KEY` |
| DeepSeek | `@ai-sdk/deepseek` | `DEEPSEEK_API_KEY` |
| XAI | `@ai-sdk/xai` | `XAI_API_KEY` |
| OpenRouter | `@ai-sdk/openrouter` | `OPENROUTER_API_KEY` |
| Replicate | `@ai-sdk/replicate` | `REPLICATE_API_TOKEN` |

## Text Generation (Chat)

### API Route Handler

```typescript
// app/api/ai/chat/route.ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { getSession } from '@/lib/auth/server';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { messages } = await request.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages,
    system: 'You are a helpful assistant.',
  });

  return result.toDataStreamResponse();
}
```

### Client Component with useChat

```typescript
'use client';

import { useChat } from '@ai-sdk/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ChatDemo() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    error,
  } = useChat({
    api: '/api/ai/chat',
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex-1 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`p-4 rounded-lg ${
              message.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'
            }`}
          >
            <p className="font-semibold">
              {message.role === 'user' ? 'You' : 'AI'}
            </p>
            <p>{message.content}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="text-red-500">Error: {error.message}</div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message..."
          disabled={isLoading}
        />
        {isLoading ? (
          <Button type="button" onClick={stop} variant="destructive">
            Stop
          </Button>
        ) : (
          <Button type="submit">Send</Button>
        )}
      </form>
    </div>
  );
}
```

## Text Generation (Non-streaming)

```typescript
// API Route
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { apiResponse } from '@/lib/api-response';

export async function POST(request: Request) {
  const { prompt } = await request.json();

  const { text } = await generateText({
    model: openai('gpt-4o'),
    prompt,
  });

  return apiResponse.success({ text });
}
```

## Image Generation (Text-to-Image)

### API Route

```typescript
// app/api/ai/text-to-image/route.ts
import { experimental_generateImage as generateImage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { apiResponse } from '@/lib/api-response';

export async function POST(request: Request) {
  const { prompt } = await request.json();

  const { image } = await generateImage({
    model: openai.image('dall-e-3'),
    prompt,
    size: '1024x1024',
  });

  // image.base64 contains the generated image
  return apiResponse.success({
    image: image.base64,
  });
}
```

### Using Replicate for Images

```typescript
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  const { prompt } = await request.json();

  const output = await replicate.run(
    'stability-ai/sdxl:latest',
    {
      input: {
        prompt,
        width: 1024,
        height: 1024,
      },
    }
  );

  return apiResponse.success({ imageUrl: output[0] });
}
```

## Image-to-Image

```typescript
// app/api/ai/image-to-image/route.ts
import Replicate from 'replicate';
import { apiResponse } from '@/lib/api-response';

const replicate = new Replicate();

export async function POST(request: Request) {
  const { imageUrl, prompt } = await request.json();

  const output = await replicate.run(
    'stability-ai/stable-diffusion-img2img:latest',
    {
      input: {
        image: imageUrl,
        prompt,
        strength: 0.7,
      },
    }
  );

  return apiResponse.success({ imageUrl: output[0] });
}
```

## Structured Output (JSON)

```typescript
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

const productSchema = z.object({
  name: z.string(),
  description: z.string(),
  price: z.number(),
  features: z.array(z.string()),
});

export async function POST(request: Request) {
  const { prompt } = await request.json();

  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: productSchema,
    prompt,
  });

  return apiResponse.success(object);
}
```

## Using Different Providers

```typescript
// OpenAI
import { openai } from '@ai-sdk/openai';
const model = openai('gpt-4o');

// Anthropic
import { anthropic } from '@ai-sdk/anthropic';
const model = anthropic('claude-3-5-sonnet-20241022');

// Google
import { google } from '@ai-sdk/google';
const model = google('gemini-1.5-pro');

// DeepSeek
import { deepseek } from '@ai-sdk/deepseek';
const model = deepseek('deepseek-chat');

// XAI
import { xai } from '@ai-sdk/xai';
const model = xai('grok-beta');

// OpenRouter (access multiple models)
import { openrouter } from '@ai-sdk/openrouter';
const model = openrouter('anthropic/claude-3.5-sonnet');
```

## Credit Deduction Pattern

```typescript
// Integrate with credit system
import { deductCredits } from '@/actions/usage/deduct';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return apiResponse.unauthorized();

  // Check and deduct credits first
  const creditResult = await deductCredits(10, 'AI chat generation');
  if (!creditResult.success) {
    return apiResponse.badRequest(creditResult.error);
  }

  // Then proceed with AI generation
  const result = streamText({
    model: openai('gpt-4o'),
    messages,
  });

  return result.toDataStreamResponse();
}
```

## Error Handling

```typescript
import { APIError } from 'ai';

try {
  const result = await generateText({ ... });
} catch (error) {
  if (error instanceof APIError) {
    console.error('AI API Error:', error.message);
    return apiResponse.error(`AI service error: ${error.message}`);
  }
  throw error;
}
```

## Environment Variables

```
OPENAI_API_KEY
ANTHROPIC_API_KEY
GOOGLE_GENERATIVE_AI_API_KEY
DEEPSEEK_API_KEY
XAI_API_KEY
OPENROUTER_API_KEY
REPLICATE_API_TOKEN

# UI Configuration (optional)
NEXT_PUBLIC_AI_MODEL_ID
NEXT_PUBLIC_AI_PROVIDER
```

## Checklist

1. Check API key is configured for chosen provider
2. Add authentication check in API route
3. Implement credit deduction if applicable
4. Handle errors gracefully
5. Use streaming for chat/long responses
6. Add stop/cancel control for streaming
7. Keep API keys server-side only
8. Consider rate limiting for production

