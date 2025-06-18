import { auth } from "../../../lib/auth";
import { db, schema } from "../../../database";
import { eq } from "drizzle-orm";
import { randomUUID } from 'node:crypto';

export default defineEventHandler(async (event) => {
    try {
        const session = await auth.api.getSession({
            headers: event.headers
        });

        if (!session?.user?.id) {
            setResponseStatus(event, 401);
            return { error: "Unauthorized" };
        }

        const { id: shareId } = getRouterParams(event);

        if (!shareId) {
            setResponseStatus(event, 400);
            return { error: "Share ID is required" };
        }

        // Find the shared chat
        const sharedChat = await db.query.sharedChats.findFirst({
            where: eq(schema.sharedChats.shareId, shareId as string),
            with: {
                thread: {
                    columns: {
                        title: true
                    }
                },
                sharedMessages: {
                    orderBy: (messages, { asc }) => [asc(messages.createdAt)],
                    with: {
                        sharedMessageAttachments: {
                            with: {
                                attachment: true
                            }
                        }
                    }
                }
            }
        });

        if (!sharedChat) {
            setResponseStatus(event, 404);
            return { error: "Share not found" };
        }

        // Create new thread for the user
        const newThreadId = randomUUID();
        const newThread = await db.insert(schema.threads)
            .values({
                id: newThreadId,
                title: `${sharedChat.thread.title}`,
                userId: session.user.id,
                userSetTitle: false,
                generationStatus: 'completed',
                createdAt: new Date(),
                updatedAt: new Date(),
                lastMessageAt: new Date()
            })
            .returning()
            .get();

        // Clone shared messages to the new thread
        if (sharedChat.sharedMessages && sharedChat.sharedMessages.length > 0) {
            const newMessages = sharedChat.sharedMessages.map(sharedMessage => ({
                id: randomUUID(),
                threadId: newThreadId,
                role: sharedMessage.role,
                status: 'done' as const,
                parts: sharedMessage.parts,
                usage: sharedMessage.usage,
                model: sharedMessage.model,
                generationStartAt: sharedMessage.generationStartAt,
                generationEndAt: sharedMessage.generationEndAt,
                createdAt: new Date(),
                updatedAt: new Date()
            }));

            const insertedMessages = await db.insert(schema.messages).values(newMessages).returning();            // Clone shared message attachments to the new messages
            for (let i = 0; i < sharedChat.sharedMessages.length; i++) {
                const sharedMessage = sharedChat.sharedMessages[i];
                const newMessage = insertedMessages[i];

                if (sharedMessage && sharedMessage.sharedMessageAttachments && sharedMessage.sharedMessageAttachments.length > 0) {
                    const newAttachments = sharedMessage.sharedMessageAttachments.map(sharedMsgAtt => ({
                        id: randomUUID(),
                        messageId: newMessage?.id || '',
                        attachmentId: sharedMsgAtt.attachmentId,
                        createdAt: new Date()
                    }));

                    if (newMessage) {
                        await db.insert(schema.messageAttachments).values(newAttachments);
                    }
                }
            }
        }

        return {
            threadId: newThread.id,
            threadUrl: `/chat/${newThread.id}`,
            title: newThread.title,
            messageCount: sharedChat.sharedMessages?.length || 0
        };

    } catch (error) {
        console.error('Error creating chat from share:', error);
        setResponseStatus(event, 500);
        return { error: "Failed to create chat from share" };
    }
});
