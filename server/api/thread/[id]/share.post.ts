import { auth } from "../../../lib/auth";
import { useDrizzle, schema } from "../../../database";
import { eq, and } from "drizzle-orm";
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const createShareSchema = z.object({
    name: z.string().max(100, "Share name cannot exceed 100 characters").optional()
});

export default defineEventHandler(async (event) => {
    try {
        const session = await auth.api.getSession({
            headers: event.headers
        });

        if (!session?.user?.id) {
            setResponseStatus(event, 401);
            return { error: "Unauthorized" };
        }

        const { id: threadId } = getRouterParams(event);
        const body = await readBody(event);
        const { name } = createShareSchema.parse(body);

        if (!threadId) {
            setResponseStatus(event, 400);
            return { error: "Thread ID is required" };
        }

        // Verify thread ownership
        const thread = await useDrizzle().query.threads.findFirst({
            where: and(
                eq(schema.threads.id, threadId as string),
                eq(schema.threads.userId, session.user.id)
            ),
            with: {
                messages: {
                    orderBy: (messages, { asc }) => [asc(messages.createdAt)],
                    with: {
                        messageAttachments: {
                            with: {
                                attachment: true
                            }
                        }
                    }
                }
            }
        });

        if (!thread) {
            setResponseStatus(event, 404);
            return { error: "Thread not found" };
        }

        // Check if there's already a share for this thread
        const existingShare = await useDrizzle().query.sharedChats.findFirst({
            where: eq(schema.sharedChats.threadId, threadId as string)
        });

        let shareId: string;
        let sharedChatId: string;

        if (existingShare) {
            // Update existing share
            shareId = existingShare.shareId;
            sharedChatId = existingShare.id;            // Update the share name and timestamp
            const updateData: { updatedAt: Date; name?: string } = {
                updatedAt: new Date()
            };
            
            if (name) {
                updateData.name = name;
            }
            
            await useDrizzle().update(schema.sharedChats)
                .set(updateData)
                .where(eq(schema.sharedChats.id, existingShare.id));

            // Delete existing shared messages to replace with current ones
            await useDrizzle().delete(schema.sharedMessages)
                .where(eq(schema.sharedMessages.sharedChatId, existingShare.id));        } else {
            // Create new share
            shareId = randomUUID().replace(/-/g, '').substring(0, 12); // Shorter, URL-friendly ID
            
            const insertData: {
                shareId: string;
                threadId: string;
                userId: string;
                createdAt: Date;
                updatedAt: Date;
                name?: string;
            } = {
                shareId,
                threadId: threadId as string,
                userId: session.user.id,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            if (name) {
                insertData.name = name;
            }
            
            const newShare = await useDrizzle().insert(schema.sharedChats)
                .values(insertData)
                .returning()
                .get();

            sharedChatId = newShare.id;
        }

        // Clone current messages to shared messages
        if (thread.messages && thread.messages.length > 0) {
            const sharedMessagesData = thread.messages.map(message => ({
                sharedChatId,
                originalMessageId: message.id,
                role: message.role,
                parts: message.parts,
                usage: message.usage,
                model: message.model,
                generationStartAt: message.generationStartAt,
                generationEndAt: message.generationEndAt,
                createdAt: new Date()
            }));

            const insertedMessages = await useDrizzle().insert(schema.sharedMessages)
                .values(sharedMessagesData)
                .returning();            // Clone message attachments
            for (let i = 0; i < thread.messages.length; i++) {
                const originalMessage = thread.messages[i];
                const sharedMessage = insertedMessages[i];

                if (originalMessage && originalMessage.messageAttachments && originalMessage.messageAttachments.length > 0) {
                    const sharedAttachmentsData = originalMessage.messageAttachments.map(msgAtt => ({
                        sharedMessageId: sharedMessage?.id || '',
                        attachmentId: msgAtt.attachmentId,
                        createdAt: new Date()
                    }));

                    if (sharedMessage) {
                        await useDrizzle().insert(schema.sharedMessageAttachments)
                            .values(sharedAttachmentsData);
                    }
                }
            }
        }

        return {
            shareId,
            shareUrl: `/share/${shareId}`,
            name,
            messageCount: thread.messages?.length || 0
        };

    } catch (error) {
        console.error('Error creating/updating share:', error);
        setResponseStatus(event, 500);
        return { error: "Failed to create/update share" };
    }
});
