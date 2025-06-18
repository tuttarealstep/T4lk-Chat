import { db, schema } from '../database';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

/**
 * Collega uno o più attachment a un messaggio nella tabella message_attachments
 * @param messageId string
 * @param attachmentIds string[]
 */
export async function linkAttachmentsToMessage(messageId: string, attachmentIds: string[]) {
  if (!messageId || !attachmentIds?.length) return;
  await Promise.all(
    attachmentIds.map(attachmentId =>
      db.insert(schema.messageAttachments).values({
        id: randomUUID(),
        messageId,
        attachmentId,
        createdAt: new Date(),
      }).execute()
    )
  );
}

/**
 * Recupera gli attachment IDs collegati a un messaggio
 * @param messageId string
 * @returns Promise<string[]>
 */
export async function getMessageAttachmentIds(messageId: string): Promise<string[]> {
  if (!messageId) return [];
  
  const messageAttachments = await db.select({
    attachmentId: schema.messageAttachments.attachmentId
  })
    .from(schema.messageAttachments)
    .where(eq(schema.messageAttachments.messageId, messageId))
    .all();
  
  return messageAttachments.map(ma => ma.attachmentId);
}
