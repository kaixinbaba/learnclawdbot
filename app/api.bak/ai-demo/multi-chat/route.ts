/**
 * ai sdk docs:
 * https://sdk.vercel.ai/docs/reference/ai-sdk-core/stream-text
 * https://sdk.vercel.ai/docs/reference/ai-sdk-core/generate-text
 * https://sdk.vercel.ai/providers/ai-sdk-providers
 */

import { createAIModel } from "@/lib/ai-model-factory";
import { apiResponse } from "@/lib/api-response";
import {
  Message,
  streamText
} from "ai";
import { z } from 'zod';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

const inputSchema = z.object({
  messages: z.array(messageSchema).min(1, "Messages cannot be empty"),
  modelId: z.string().min(1, "Model ID cannot be empty"),
  provider: z.string().min(1, "Provider cannot be empty"),
});

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return apiResponse.badRequest("This page is only for administrators to test locally. Please purchase nexty.dev to test it yourself.");
  }

  try {
    const rawBody = await req.json();

    const validationResult = inputSchema.safeParse(rawBody);
    if (!validationResult.success) {
      return apiResponse.badRequest(`Invalid input: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }

    const { messages, modelId, provider } = validationResult.data;


    let model;
    try {
      model = createAIModel(provider, modelId);
    } catch (error) {
      console.error("Failed to create AI model:", error);
      const message = error instanceof Error ? error.message : String(error);
      return apiResponse.serverError(message);
    }

    const result = await streamText({
      model: model,
      messages: messages as Message[],
    });

    return result.toDataStreamResponse({
      sendReasoning: true,
    });

  } catch (error: any) {
    console.error("Chat generation failed:", error);
    const errorMessage = error?.message || "Failed to generate response";
    if (errorMessage.includes("API key")) {
      return apiResponse.serverError(`Server configuration error: ${errorMessage}`);
    }
    return apiResponse.serverError(errorMessage);
  }
}