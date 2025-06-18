import { auth } from '../lib/auth'
import { db } from '../database'
import { favoriteModels } from '../database/schema'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
    const session = await auth.api.getSession({
        headers: new Headers(getHeaders(event) as Record<string, string>)
    })

    if (!session?.user) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized'
        })
    }

    const { user } = session
    const method = event.node.req.method

    if (method === 'GET') {
        // Get user's favorite models
        const favorites = await db.select().from(favoriteModels).where(eq(favoriteModels.userId, user.id))
        return favorites.map(f => f.modelId)
    }

    if (method === 'POST') {
        // Add a model to favorites
        const body = await readBody(event)
        const { modelId } = body

        if (!modelId) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Model ID is required'
            })
        }

        // Check if already exists
        const existing = await db.select().from(favoriteModels)
            .where(and(eq(favoriteModels.userId, user.id), eq(favoriteModels.modelId, modelId)))

        if (existing.length > 0) {
            throw createError({
                statusCode: 409,
                statusMessage: 'Model already in favorites'
            })
        }

        await db.insert(favoriteModels).values({
            userId: user.id,
            modelId
        })

        return { success: true }
    }

    if (method === 'DELETE') {
        // Remove a model from favorites
        const body = await readBody(event)
        const { modelId } = body

        if (!modelId) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Model ID is required'
            })
        }

        await db.delete(favoriteModels)
            .where(and(eq(favoriteModels.userId, user.id), eq(favoriteModels.modelId, modelId)))

        return { success: true }
    }

    throw createError({
        statusCode: 405,
        statusMessage: 'Method not allowed'
    })
})
