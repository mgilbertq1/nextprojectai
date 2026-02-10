import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";

export async function getSystemFlag(key: string): Promise<string | null> {
  const result = await db.execute<{ value: string }>(sql`
    select value from system_flags
    where key = ${key}
    limit 1
  `);

  return result[0]?.value ?? null;
}
