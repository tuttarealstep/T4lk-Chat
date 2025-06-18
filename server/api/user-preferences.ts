import { auth } from '../lib/auth'
import { db, schema } from '../database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user?.id) {
    setResponseStatus(event, 401)
    return { error: 'Unauthorized' }
  }
  const userId = session.user.id
  const method = event.node.req.method
  if (method === 'GET') {
    // Recupera preferenze
    const prefs = await db.select().from(schema.userPreferences).where(eq(schema.userPreferences.userId, userId)).get()
    if (!prefs) {
      return {
        name: '', occupation: '', selectedTraits: [], additionalInfo: '', lastSelectedModel: null, statsForNerds: false
      }
    }
    return prefs
  }

  if (method === 'PATCH' || method === 'POST') {
    const body = await readBody(event)
    // Validazione base
    const name = (body.name || '').slice(0, 50)
    const occupation = (body.occupation || '').slice(0, 100)
    const selectedTraits = Array.isArray(body.selectedTraits) ? body.selectedTraits.slice(0, 50).map((t: string) => t.slice(0, 100)) : []
    const additionalInfo = (body.additionalInfo || '').slice(0, 3000)
    const lastSelectedModel = body.lastSelectedModel || null
    const statsForNerds = Boolean(body.statsForNerds)    // Upsert
    const existing = await db.select().from(schema.userPreferences).where(eq(schema.userPreferences.userId, userId)).get()
    if (existing) {
      await db.update(schema.userPreferences).set({ name, occupation, selectedTraits, additionalInfo, lastSelectedModel, statsForNerds, updatedAt: new Date() }).where(eq(schema.userPreferences.userId, userId)).execute()
    } else {
      await db.insert(schema.userPreferences).values({ userId, name, occupation, selectedTraits, additionalInfo, lastSelectedModel, statsForNerds, createdAt: new Date(), updatedAt: new Date() }).execute()
    }
    return { success: true }
  }

  setResponseStatus(event, 405)
  return { error: 'Method not allowed' }
}) 