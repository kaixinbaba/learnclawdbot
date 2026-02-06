/**
 * ai sdk docs:
 * https://sdk.vercel.ai/docs/reference/ai-sdk-core/stream-text
 * https://sdk.vercel.ai/docs/reference/ai-sdk-core/generate-text
 * https://sdk.vercel.ai/providers/ai-sdk-providers
 */

import { createAIModel } from "@/lib/ai-model-factory";
import { apiResponse } from "@/lib/api-response";
import {
  streamText
} from "ai";
import { z } from 'zod';

const inputSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty"),
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

    const { prompt, modelId, provider } = validationResult.data;


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
      prompt: prompt,
      // debug
      // onChunk: async (chunk) => {
      //   console.log("Chunk received:", chunk);
      // },
      // onFinish({ text, finishReason, usage, response }) {
      //   // If you want to save the generated result, you can write it to the database here
      //   // 如果你想保存生成结果，可以在这里写入数据库
      //   // 生成結果を保存したい場合は、ここにデータベースに書き込むことができます
      //   const messages = response.messages;
      //   console.log("Generation completed", messages);
      // },
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