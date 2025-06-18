import { betterAuth } from "better-auth";
import { anonymous } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { schema, useDrizzle } from "../database";
import { eq } from "drizzle-orm";

export const auth = betterAuth({
    database: drizzleAdapter(useDrizzle(), {
        provider: "sqlite",
        schema: {
            ...schema
        }
    }),
    trustedOrigins: [
        'http://localhost:3000', 
        'http://localhost:8787',        
    ],
    socialProviders: {
        github: {
            clientId: process.env.PROVIDER_GITHUB_CLIENT_ID as string,
            clientSecret: process.env.PROVIDER_GITHUB_CLIENT_SECRET as string,
        },
    },
    plugins: [
        anonymous({
            onLinkAccount: async ({ anonymousUser, newUser }) => {
                try {
                    // Update threads of the anonymous user to the new user
                    await useDrizzle().update(schema.threads)
                        .set({ userId: newUser.user.id })
                        .where(eq(schema.threads.userId, anonymousUser.user.id));                      // Update attachments of the anonymous user to the new user
                    await useDrizzle().update(schema.attachments)
                        .set({ userId: newUser.user.id })
                        .where(eq(schema.attachments.userId, anonymousUser.user.id));

                    // Update favorite models of the anonymous user to the new user
                    await useDrizzle().update(schema.favoriteModels)
                        .set({ userId: newUser.user.id })
                        .where(eq(schema.favoriteModels.userId, anonymousUser.user.id));

                    // Update shared chats of the anonymous user to the new user
                    await useDrizzle().update(schema.sharedChats)
                        .set({ userId: newUser.user.id })
                        .where(eq(schema.sharedChats.userId, anonymousUser.user.id));

                    // Update user preferences (if they exist) of the anonymous user to the new user
                    // First check if the new user already has preferences
                    const existingPreferences = await useDrizzle().select()
                        .from(schema.userPreferences)
                        .where(eq(schema.userPreferences.userId, newUser.user.id))
                        .get();

                    if (!existingPreferences) {
                        // New user has no preferences, migrate from anonymous user
                        await useDrizzle().update(schema.userPreferences)
                            .set({ userId: newUser.user.id })
                            .where(eq(schema.userPreferences.userId, anonymousUser.user.id));
                        console.log(`Migrated preferences from anonymous user ${anonymousUser.user.id} to user ${newUser.user.id}`);
                    } else {
                        // New user already has preferences, delete anonymous user preferences
                        // to avoid conflicts (keep the registered user's preferences)
                        await useDrizzle().delete(schema.userPreferences)
                            .where(eq(schema.userPreferences.userId, anonymousUser.user.id));
                        console.log(`Deleted anonymous user preferences (user ${newUser.user.id} already has preferences)`);
                    }

                    console.log(`Successfully migrated data from anonymous user ${anonymousUser.user.id} to user ${newUser.user.id}`);
                } catch (error) {
                    console.error('Error migrating user data during account linking:', error);
                    // Log more details about the error
                    if (error instanceof Error) {
                        console.error('Error details:', error.message);
                        console.error('Error stack:', error.stack);
                    }
                    throw error;
                }
            }
        })
    ]
})