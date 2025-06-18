import { useDrizzle, schema } from "../../database";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { linkAttachmentsToMessage } from '../attachments';
import type { Message } from "ai";

function getTextFromParts(parts: Array<Message['parts']> | null | undefined): string {
    if (!parts || !Array.isArray(parts) || parts.length === 0) {
        return '';
    }

    const textPart = parts.find((part) => part?.type === 'text' && typeof part.text === 'string');
    return textPart?.text || '';
}

export interface MessageSaveOptions {
  threadId: string;
  messages: Message[];
  model: string;
  attachmentIds?: string[];
}

export async function saveMessagesToDatabase(options: MessageSaveOptions) {
  const { threadId, messages, model, attachmentIds } = options;
  
  const existingMessages = await useDrizzle().select()
    .from(schema.messages)
    .where(eq(schema.messages.threadId, threadId))
    .orderBy(schema.messages.createdAt)
    .all();

  let editDetected = false;
  let editStartIndex = -1;
  let lastUserMessageId: string | undefined;
  let messageIdForGeneration: string | undefined;

  if (messages.length > 0 && messages.length <= existingMessages.length) {
    const lastIncomingMsg = messages[messages.length - 1];

    if (lastIncomingMsg.role === 'user' && messages.length <= existingMessages.length) {
      for (let i = 0; i < existingMessages.length; i++) {
        const existingMsg = existingMessages[i];
        if (existingMsg.role === 'user') {
          const incomingContent = getTextFromParts(lastIncomingMsg.parts);
          const existingContent = getTextFromParts(existingMsg.parts);

          if (incomingContent === existingContent && i < existingMessages.length - 1) {
            editDetected = true;
            editStartIndex = i + 1;
            break;
          }
        }
      }
    }
  }

  if (!editDetected) {
    for (let i = 0; i < Math.min(messages.length, existingMessages.length); i++) {
      const incomingMsg = messages[i];
      const existingMsg = existingMessages[i];

      if (incomingMsg.role !== 'user' && incomingMsg.role !== 'assistant') {
        continue;
      }

      if (existingMsg.role === 'user' && incomingMsg.role === 'user') {
        const existingContent = getTextFromParts(existingMsg.parts);
        const incomingContent = getTextFromParts(incomingMsg.parts);

        if (existingContent !== incomingContent) {
          editDetected = true;
          editStartIndex = i;
          break;
        }
      }

      if (incomingMsg.id && existingMsg.id === incomingMsg.id) {
        if (existingMsg.threadId !== threadId) {
          throw new Error("Message does not belong to this thread");
        }
      }
    }
  }

  if (editDetected && editStartIndex >= 0) {
    const messagesToDelete = existingMessages.slice(editStartIndex);
    for (const msgToDelete of messagesToDelete) {
      await useDrizzle().delete(schema.messages)
        .where(eq(schema.messages.id, msgToDelete.id))
        .execute();
    }
  }

  for (const [index, message] of messages.entries()) {
    if (message.role !== 'user' && message.role !== 'assistant') {
      continue;
    }

    let shouldSave = false;

    if (editDetected) {
      if (index === messages.length - 1 && message.role === 'user') {
        const userExists = existingMessages.some(existing => {
          const existingContent = getTextFromParts(existing.parts);
          const incomingContent = getTextFromParts(message.parts);
          return existing.role === 'user' && existingContent === incomingContent;
        });
        shouldSave = !userExists;
      }
    } else {
      shouldSave = index >= existingMessages.length;
    }

    if (shouldSave) {
      const messageId = message.id || randomUUID();
      await useDrizzle().insert(schema.messages)
        .values({
          id: messageId,
          threadId: threadId,
          role: message.role as 'user' | 'assistant',
          status: index === messages.length - 1 ? 'pending' : 'done',
          parts: message.parts || [],
          model: model,
          usage: (message as any).usage,
          generationStartAt: (message as any).generationStartAt ? new Date((message as any).generationStartAt) : undefined,
          generationEndAt: (message as any).generationEndAt ? new Date((message as any).generationEndAt) : undefined,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .execute();

      if (index === messages.length - 1 && message.role === 'user') {
        lastUserMessageId = messageId;
        messageIdForGeneration = messageId;
      }
    }
  }

  if (lastUserMessageId && Array.isArray(attachmentIds) && attachmentIds.length > 0) {
    await linkAttachmentsToMessage(lastUserMessageId, attachmentIds);
  }

  return { messageIdForGeneration };
}

export async function updateMessageStatus(messageId: string, status: 'pending' | 'done' | 'waiting') {
  await useDrizzle().update(schema.messages)
    .set({
      status: status,
      updatedAt: new Date()
    })
    .where(eq(schema.messages.id, messageId))
    .execute();
}

export async function createAssistantMessage(options: {
  threadId: string;
  model: string;
  parts: any[];
  usage?: any;
  generationStartAt: number;
  generationEndAt: number;
}) {
  const { threadId, model, parts, usage, generationStartAt, generationEndAt } = options;
  const assistantMessageId = randomUUID();

  await useDrizzle().insert(schema.messages)
    .values({
      id: assistantMessageId,
      threadId: threadId,
      role: 'assistant',
      status: 'done',
      parts: parts,
      usage: usage,
      model: model,
      generationStartAt: new Date(generationStartAt),
      generationEndAt: new Date(generationEndAt),
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .execute();

  return assistantMessageId;
}