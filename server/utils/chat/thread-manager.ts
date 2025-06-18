import { useDrizzle, schema } from "../../database";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { generateThreadTitle } from "../ai/utils";
import { Message } from "ai";
import { ApiKeys } from "#shared/types/api-keys";

export interface ThreadMetadata {
  id?: string;
}

export interface CreateThreadOptions {
  userId: string;
  threadMetadata: ThreadMetadata;
  firstMessage?: Message;
  apiKeys: ApiKeys;
}

export async function handleThreadCreation(options: CreateThreadOptions) {
  const { userId, threadMetadata, firstMessage, apiKeys } = options;
  
  let threadId = threadMetadata.id;
  let thread: typeof schema.threads.$inferInsert | null = null;

  if (threadId) {
    const existingThread = await useDrizzle().select()
      .from(schema.threads)
      .where(and(
        eq(schema.threads.id, threadId),
        eq(schema.threads.userId, userId)
      ))
      .get();

    if (!existingThread) {
      threadId = randomUUID();
      thread = await useDrizzle().insert(schema.threads)
        .values({
          id: threadId,
          userId: userId,
          generationStatus: 'pending'
        })
        .returning()
        .get();
    } else {
      thread = existingThread;
    }
  } else {
    threadId = randomUUID();
    thread = await useDrizzle().insert(schema.threads)
      .values({
        id: threadId,
        userId: userId,
        generationStatus: 'pending'
      })
      .returning()
      .get();
  }

  if (!thread.title && firstMessage) {
    const firstTextMessage = firstMessage.parts?.find((part: any) => part.type === 'text');
    
    if (firstTextMessage?.text) {
      const title = await generateThreadTitle(firstTextMessage.text, apiKeys);
      
      await useDrizzle().update(schema.threads)
        .set({
          title: title,
          userSetTitle: false,
          updatedAt: new Date()
        })
        .where(eq(schema.threads.id, threadId))
        .execute();

      thread.title = title;
    }
  }

  return { threadId, thread };
}

export async function updateThreadStatus(threadId: string, status: 'pending' | 'generating' | 'completed') {
  await useDrizzle().update(schema.threads)
    .set({
      lastMessageAt: new Date(),
      updatedAt: new Date(),
      generationStatus: status
    })
    .where(eq(schema.threads.id, threadId))
    .execute();
}