import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";

export async function getSystemFlags() {
  return db.execute(sql`select key, value from system_flags`);
}

export async function updateSystemFlag(key: string, value: string) {
  return db.execute(sql`
    update system_flags
    set value = ${value}
    where key = ${key}
  `);
}