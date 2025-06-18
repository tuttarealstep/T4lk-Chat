import { randomUUID } from "node:crypto";
import { experimental_generateImage as generateImage } from "ai";
import { getImageProvider } from "../ai/utils";
import { createAssistantMessage, updateMessageStatus } from "./message-manager";
import { updateThreadStatus } from "./thread-manager";
import type { LLMInfo } from "#shared/ai/LLM";
import { LLM_PROVIDERS } from "#shared/ai/LLM";
import { ApiKeys } from "#shared/types/api-keys";
import type { Message } from "ai";

export interface ImageGenerationParams {
  n?: number;
  size?: string;
  openai?: {
    quality?: string;
    background?: string;
    output_format?: string;
    output_compression?: number;
    moderation?: string;
  };
}

export interface ImageGenerationOptions {
  messages: Message[];
  model: string;
  llmInfo: LLMInfo;
  apiKeys: ApiKeys;
  messageId: string;
  threadId: string;
  modelParams?: { imageGeneration?: ImageGenerationParams };
  dataStream: any;
}

export async function handleImageGeneration(options: ImageGenerationOptions) {
  const { messages, model, llmInfo, apiKeys, messageId, threadId, modelParams, dataStream } = options;

  const lastUserMessage = messages.filter(m => m.role === 'user').pop();
  if (!lastUserMessage || !lastUserMessage.content || typeof lastUserMessage.content !== 'string') {
    dataStream.writeData({
      type: 'error',
      error: 'No valid prompt found for image generation'
    });
    return;
  }

  const prompt = lastUserMessage.content;
  const imageParams = modelParams?.imageGeneration || {
    n: 1,
    size: '1024x1024' as const,
    openai: {
      quality: 'auto' as const,
      background: 'auto' as const,
      output_format: 'png' as const,
      output_compression: 100,
      moderation: 'auto' as const
    }
  };

  try {
    const generationStartAt = Date.now();

    const imageProviderOptions: Record<string, any> = {};
    if (imageParams.openai && llmInfo.provider === LLM_PROVIDERS.OPENAI) {
      imageProviderOptions.openai = {
        quality: imageParams.openai.quality || 'auto',
        background: imageParams.openai.background || 'auto',
        output_format: imageParams.openai.output_format || 'png',
        output_compression: imageParams.openai.output_compression || 100,
        moderation: imageParams.openai.moderation || 'auto'
      };
    }

    const imageModel = getImageProvider(model, llmInfo, apiKeys);

    let size: `${number}x${number}` | undefined;
    if (imageParams.size === 'auto') {
      size = undefined;
    } else {
      size = imageParams.size as `${number}x${number}`;
    }

    const imageResult = await generateImage({
      model: imageModel,
      prompt: prompt,
      n: imageParams.n || 1,
      size: size,
      providerOptions: imageProviderOptions
    });

    const generationEndAt = Date.now();
    const responseTime = (generationEndAt - generationStartAt) / 1000;

    await updateMessageStatus(messageId, 'done');

    let images: { base64: string; url?: string }[];

    if ('images' in imageResult && Array.isArray(imageResult.images)) {
      images = imageResult.images.map((img: { base64: string; url?: string }) => ({
        base64: img.base64,
        url: img.url
      }));
    } else if ('image' in imageResult && imageResult.image) {
      const img = imageResult.image as { base64: string; url?: string };
      images = [{ base64: img.base64, url: img.url }];
    } else {
      images = [];
    }

    const messageParts = images.map((img) => ({
      type: 'file' as const,
      mimeType: `image/${imageParams.openai?.output_format || 'png'}`,
      data: `data:image/${imageParams.openai?.output_format || 'png'};base64,${img.base64}`
    }));

    const assistantMessageId = await createAssistantMessage({
      threadId,
      model,
      parts: messageParts,
      generationStartAt,
      generationEndAt
    });

    await updateThreadStatus(threadId, 'completed');

    dataStream.writeData({
      type: 'images',
      data: {
        images: images.map((img) => ({
          base64: img.base64,
          url: img.url || ''
        })),
        messageId: assistantMessageId,
        model,
        generationStartAt,
        generationEndAt,
        responseTime
      }
    });

  } catch (error) {
    console.error("Image generation error:", error);
    dataStream.writeData({
      type: 'error',
      error: error instanceof Error ? error.message : 'Image generation failed'
    });

    await updateMessageStatus(messageId, 'waiting');
  }
}