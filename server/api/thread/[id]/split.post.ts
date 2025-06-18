import { auth } from "../../../lib/auth";
import { db, schema } from "../../../database";
import { eq, and, lte } from "drizzle-orm";
import { randomUUID } from 'node:crypto';

export default defineEventHandler(async (event) => {
    try {
        const session = await auth.api.getSession({
            headers: event.headers
        });

        if (!session) {
            setResponseStatus(event, 401);
            return { error: "Unauthorized" };
        }

        const { id: threadId } = getRouterParams(event);
        const { messageId } = await readBody(event);

        if (!threadId || !messageId) {
            setResponseStatus(event, 400);
            return { error: "Thread ID and Message ID are required" };
        }

        // Get the original thread to verify ownership
        const originalThread = await db.query.threads.findFirst({
            where: and(
                eq(schema.threads.id, threadId as string),
                eq(schema.threads.userId, session.user?.id || session.user.id)
            )
        });

        if (!originalThread) {
            setResponseStatus(event, 404);
            return { error: "Thread not found" };
        }

        // Get the target message to verify it exists and get its timestamp
        const targetMessage = await db.query.messages.findFirst({
            where: and(
                eq(schema.messages.id, messageId as string),
                eq(schema.messages.threadId, threadId as string)
            )
        });

        if (!targetMessage) {
            setResponseStatus(event, 404);
            return { error: "Message not found" };
        }

        // Get all messages up to and including the target message (by creation time)
        const messagesToCopy = await db.query.messages.findMany({
            where: and(
                eq(schema.messages.threadId, threadId as string),
                lte(schema.messages.createdAt, targetMessage.createdAt)
            ),
            orderBy: (messages, { asc }) => [asc(messages.createdAt)]
        });

        // Create new thread
        const newThreadId = randomUUID();
        const newThread = await db.insert(schema.threads)
            .values({
                id: newThreadId,
                title: `${originalThread.title}`,
                userId: session.user?.id || session.user.id,
                userSetTitle: false,
                generationStatus: 'completed',
                branchedFromThreadId: threadId as string,
                createdAt: new Date(),
                updatedAt: new Date()
            })
            .returning()
            .get();

        // Copy messages to the new thread
        if (messagesToCopy.length > 0) {
            const newMessages = messagesToCopy.map(msg => ({
                id: randomUUID(),
                threadId: newThreadId,
                role: msg.role,
                status: msg.status,
                parts: msg.parts,
                usage: msg.usage,
                model: msg.model,
                generationStartAt: msg.generationStartAt,
                generationEndAt: msg.generationEndAt,
                createdAt: new Date(),
                updatedAt: new Date()
            }));

            await db.insert(schema.messages).values(newMessages);
        }

        // Return the new thread
        return {
            ...newThread,
            to: `/chat/${newThread.id}`
        };

    } catch (error) {
        console.error("Error splitting thread:", error);
        setResponseStatus(event, 500);
        return { error: "Internal server error" };
    }
});
