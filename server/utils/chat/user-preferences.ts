import { useDrizzle, schema } from "../../database";
import { eq } from "drizzle-orm";

export async function updateUserLastSelectedModel(userId: string, model: string) {
  const existingPrefs = await useDrizzle().select()
    .from(schema.userPreferences)
    .where(eq(schema.userPreferences.userId, userId))
    .get();

  if (existingPrefs) {
    await useDrizzle().update(schema.userPreferences)
      .set({
        lastSelectedModel: model,
        updatedAt: new Date()
      })
      .where(eq(schema.userPreferences.userId, userId))
      .execute();
  } else {
    await useDrizzle().insert(schema.userPreferences)
      .values({
        userId,
        lastSelectedModel: model,
        name: '',
        occupation: '',
        selectedTraits: [],
        additionalInfo: '',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .execute();
  }
}