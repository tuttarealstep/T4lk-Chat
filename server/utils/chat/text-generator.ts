import { smoothStream, streamText, type ToolChoice, type ToolSet } from "ai";
import { openai } from "@ai-sdk/openai";
import { randomUUID } from "node:crypto";
import { chatSystemPrompt } from "../ai/prompts";
import { createAssistantMessage, updateMessageStatus } from "./message-manager";
import { updateThreadStatus } from "./thread-manager";
import { LLM_FEATURES, LLM_PROVIDERS, type LLMInfo } from "#shared/ai/LLM";
import type { Message } from "ai";

export interface TextGenerationOptions {
  aiProvider: any;
  llmInfo: LLMInfo;
  messages: Message[];
  preferences: any;
  userInfo: any;
  providerOptions: Record<string, Record<string, unknown>>;
  webSearchEnabled: boolean;
  controller: AbortController;
  messageId: string;
  threadId: string;
  model: string;
  dataStream: any;
}

export function handleTextGeneration(options: TextGenerationOptions) {
  const {
    aiProvider,
    llmInfo,
    messages,
    preferences,
    userInfo,
    providerOptions,
    webSearchEnabled,
    controller,
    messageId,
    threadId,
    model,
    dataStream
  } = options;

  const generationStartAt = Date.now();

  const tools: ToolSet = {};
  let toolChoice: ToolChoice<ToolSet> | undefined = undefined;

  if (webSearchEnabled && llmInfo.provider == LLM_PROVIDERS.OPENAI && llmInfo.features.includes(LLM_FEATURES.SEARCH)) {
    tools.web_search_preview = openai.tools.webSearchPreview({});

    if (!toolChoice) {
      toolChoice = {} as ToolChoice<ToolSet>;
    }

    toolChoice = {
      type: 'tool',
      toolName: 'web_search_preview',
    };
  }

  const streamResult = streamText({
    model: aiProvider,
    maxTokens: 10000,
    system: chatSystemPrompt(preferences, userInfo),
    messages: messages,
    providerOptions: providerOptions as any,
    abortSignal: controller.signal,
    tools: tools,
    toolChoice: toolChoice,
    experimental_transform: llmInfo.streamChunking ? smoothStream({
      chunking: llmInfo.streamChunking || 'word',
    }) : undefined,
    async onFinish(streamResponse: any) {
      const generationEndAt = Date.now();
      const responseTime = (generationEndAt - generationStartAt) / 1000;
      const promptTokens = streamResponse.usage?.promptTokens || 0;
      const completionTokens = streamResponse.usage?.completionTokens || 0;
      const totalTokens = promptTokens + completionTokens;
      const tokensPerSecond = totalTokens / responseTime;

      await updateMessageStatus(messageId, 'done');

      const messageParts: typeof import("../../database/schema").messages.$inferInsert['parts'] = [];

      if (streamResponse.reasoning) {
        messageParts.push({
          type: 'reasoning',
          reasoning: streamResponse.reasoning || '',
          details: [{
            type: 'text',
            text: streamResponse.reasoning || ''
          }]
        });
      }

      messageParts.push({
        type: 'text',
        text: streamResponse.text
      });

      const assistantMessageId = await createAssistantMessage({
        threadId,
        model,
        parts: messageParts,
        usage: streamResponse.usage,
        generationStartAt,
        generationEndAt
      });

      await updateThreadStatus(threadId, 'completed');

      dataStream.writeData({
        type: 'metrics',
        data: {
          tokensPerSecond,
          promptTokens,
          completionTokens,
          totalTokens,
          generationStartAt,
          generationEndAt,
          model,
          messageId: assistantMessageId,
        }
      });
    },
    onError(error: any) {
      console.error("AI generation error:", error);

      updateMessageStatus(messageId, 'waiting');
    },
  });

  streamResult.mergeIntoDataStream(dataStream, {
    sendReasoning: true,
    sendUsage: true,
  });
}