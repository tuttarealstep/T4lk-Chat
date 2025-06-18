import { auth } from '../../lib/auth'
import { db, schema } from '../../database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user?.id) {
    setResponseStatus(event, 401)
    return { error: 'Unauthorized' }
  }
  
  const userId = session.user.id
  const body = await readBody(event)
  
  if (!body.modelId || typeof body.modelId !== 'string') {
    setResponseStatus(event, 400)
    return { error: 'Model ID is required' }
  }
  
  // Upsert delle preferenze utente con l'ultimo modello selezionato
  const existing = await db.select().from(schema.userPreferences).where(eq(schema.userPreferences.userId, userId)).get()
  
  if (existing) {
    await db.update(schema.userPreferences)
      .set({ 
        lastSelectedModel: body.modelId,
        updatedAt: new Date() 
      })
      .where(eq(schema.userPreferences.userId, userId))
      .execute()
  } else {
    await db.insert(schema.userPreferences)
      .values({ 
        userId, 
        lastSelectedModel: body.modelId,
        name: '',
        occupation: '',
        selectedTraits: [],
        additionalInfo: '',
        createdAt: new Date(), 
        updatedAt: new Date() 
      })
      .execute()
  }
  
  return { success: true }
})
