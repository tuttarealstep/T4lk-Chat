import 'dotenv/config';
import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import Database from 'better-sqlite3';


export function useDrizzle() {
  let db;

  if (process.env.NODE_ENV === 'production' && process.env.NUXT_HUB_PROJECT_KEY) {
    // Usa NuxtHub D1 in produzione o con NuxtHub
    db = drizzleD1(hubDatabase(), { schema });
  } else {
    // Usa SQLite locale in sviluppo
    const sqlite = new Database(process.env.DB_FILE_NAME || './server/database/db.sqlite');
    db = drizzle(sqlite, { schema });
  }

  //return drizzleD1(hubDatabase(), { schema });;
  return db;
}

export { schema };