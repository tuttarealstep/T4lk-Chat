import { auth } from "../lib/auth";
import { useDrizzle, schema } from "../database";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
    const session = await auth.api.getSession({
        headers: event.headers
    });

    if (!session) {
        setResponseStatus(event, 401);
        return { error: "Unauthorized" };
    }

    const threads = (await useDrizzle().select()
        .from(schema.threads)
        .where(eq(schema.threads.userId, session.user?.id || session.user.id)))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

    return threads
})