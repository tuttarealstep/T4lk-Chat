import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
    dialect: 'sqlite',
    schema: './server/database/schema.ts',
    out: './server/database/migrations',
    ...process.env.DB_FILE_NAME ? {
        dbCredentials: {
            url: process.env.DB_FILE_NAME!,
        }
    } : undefined
})
