import { auth } from "../../lib/auth";
import { useDrizzle, schema } from "../../database";
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

const updateThreadSchema = z.object({
    title: z.string().min(1, "Title cannot be empty").max(300, "Title cannot exceed 300 characters").optional(),
    pinned: z.boolean().optional(),
    branchedFromThreadId: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
    try {
        const threadId = getRouterParam(event, 'id')
        const session = await auth.api.getSession({
            headers: event.headers
        })

        if (!session?.user?.id) {
            setResponseStatus(event, 401);
            return { error: "Unauthorized" };
        }

        if (!threadId) {
            setResponseStatus(event, 400);
            return { error: "Thread ID is required" };
        }

        const body = await readBody(event)
        const validatedData = updateThreadSchema.parse(body)

        // Verifica che il thread appartenga all'utente
        const existingThread = await useDrizzle().query.threads.findFirst({
            where: and(eq(schema.threads.id, threadId), eq(schema.threads.userId, session.user.id))
        });

        if (existingThread.length === 0) {
            setResponseStatus(event, 404);
            return { error: "Thread not found" };
        }        // Aggiorna il thread
        const updateData: {
            updatedAt: Date
            title?: string
            userSetTitle?: boolean
            pinned?: boolean
            branchedFromThreadId?: string | null
        } = {
            updatedAt: new Date(),
        }

        if (validatedData.title !== undefined) {
            updateData.title = validatedData.title
            updateData.userSetTitle = true
        } if (validatedData.pinned !== undefined) {
            updateData.pinned = validatedData.pinned
        }

        if (validatedData.branchedFromThreadId !== undefined) {
            updateData.branchedFromThreadId = validatedData.branchedFromThreadId
        }

        const [updatedThread] = await useDrizzle()
            .update(schema.threads)
            .set(updateData)
            .where(and(eq(schema.threads.id, threadId), eq(schema.threads.userId, session.user.id)))
            .returning()

        return updatedThread
    } catch (error) {
        console.error('Error updating thread:', error)
        setResponseStatus(event, 500);
        return { error: "Failed to update thread" };
    }
})
