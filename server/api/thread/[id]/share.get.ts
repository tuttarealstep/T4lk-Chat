import { auth } from "../../../lib/auth";
import { useDrizzle, schema } from "../../../database";
import { eq, and } from "drizzle-orm";

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

        if (!threadId) {
            setResponseStatus(event, 400);
            return { error: "Thread ID is required" };
        }

        // Verify thread ownership and get share info
        const thread = await useDrizzle().query.threads.findFirst({
            where: and(
                eq(schema.threads.id, threadId as string),
                eq(schema.threads.userId, session.user.id)
            )
        });

        if (!thread) {
            setResponseStatus(event, 404);
            return { error: "Thread not found" };
        }

        // Check if there's a share for this thread
        const existingShare = await useDrizzle().query.sharedChats.findFirst({
            where: eq(schema.sharedChats.threadId, threadId as string),
            with: {
                sharedMessages: true
            }
        });

        if (!existingShare) {
            return { hasShare: false };
        }

        return {
            hasShare: true,
            shareId: existingShare.shareId,
            shareUrl: `/share/${existingShare.shareId}`,
            name: existingShare.name,
            messageCount: existingShare.sharedMessages?.length || 0,
            createdAt: existingShare.createdAt,
            updatedAt: existingShare.updatedAt
        };

    } catch (error) {
        console.error('Error getting share info:', error);
        setResponseStatus(event, 500);
        return { error: "Failed to get share info" };
    }
});
