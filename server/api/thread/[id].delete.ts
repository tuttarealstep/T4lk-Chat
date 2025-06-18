import { auth } from "../../lib/auth";
import { db, schema } from "../../database";
import { eq, and } from 'drizzle-orm'

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

    // Verifica che il thread appartenga all'utente
    const existingThread = await db
      .select()
      .from(schema.threads)
      .where(and(eq(schema.threads.id, threadId), eq(schema.threads.userId, session.user.id)))
      .limit(1)

    if (existingThread.length === 0) {
      setResponseStatus(event, 404);
      return { error: "Thread not found" };
    }

    // Prima di eliminare il thread, pulisci i riferimenti orfani nei thread che puntano a questo
    await db
      .update(schema.threads)
      .set({ branchedFromThreadId: null })
      .where(eq(schema.threads.branchedFromThreadId, threadId))

    // Elimina il thread (i messaggi vengono eliminati automaticamente per cascade)
    await db
      .delete(schema.threads)
      .where(and(eq(schema.threads.id, threadId), eq(schema.threads.userId, session.user.id)))

    return { success: true }
  } catch (error) {
    console.error('Error deleting thread:', error)
    setResponseStatus(event, 500);
    return { error: "Failed to delete thread" };
  }
})
