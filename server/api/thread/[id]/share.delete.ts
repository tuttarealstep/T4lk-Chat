import { auth } from "../../../lib/auth";
import { db, schema } from "../../../database";
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

        // Verify thread ownership
        const thread = await db.query.threads.findFirst({
            where: and(
                eq(schema.threads.id, threadId as string),
                eq(schema.threads.userId, session.user.id)
            )
        });

        if (!thread) {
            setResponseStatus(event, 404);
            return { error: "Thread not found" };
        }

        // Find and delete the share
        const existingShare = await db.query.sharedChats.findFirst({
            where: eq(schema.sharedChats.threadId, threadId as string)
        });

        if (!existingShare) {
            setResponseStatus(event, 404);
            return { error: "Share not found" };
        }

        // Delete the share (cascade will handle shared messages and attachments)
        await db.delete(schema.sharedChats)
            .where(eq(schema.sharedChats.id, existingShare.id));

        return { success: true };

    } catch (error) {
        console.error('Error deleting share:', error);
        setResponseStatus(event, 500);
        return { error: "Failed to delete share" };
    }
});
