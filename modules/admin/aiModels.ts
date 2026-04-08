import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  model_id: string;
  api_key: string;
  base_url: string;
  enabled: boolean;
  is_default: boolean;
  created_at: string;
}

// ================================
// GET ALL MODELS (admin)
// ================================
export async function getAllModels(): Promise<AIModel[]> {
  const rows = await db.execute(sql`
    select id, name, provider, model_id, api_key, base_url, enabled, is_default, created_at
    from ai_models
    order by is_default desc, created_at asc
  `);
  return rows.map((r: any) => r as AIModel);
}

// ================================
// GET ENABLED MODELS (user-facing, no api_key)
// ================================
export async function getEnabledModels() {
  const rows = await db.execute(sql`
    select id, name, provider, model_id, is_default
    from ai_models
    where enabled = true
    order by is_default desc, created_at asc
  `);
  return rows;
}

// ================================
// GET DEFAULT MODEL
// ================================
export async function getDefaultModel(): Promise<AIModel | null> {
  const rows = await db.execute(sql`
    select id, name, provider, model_id, api_key, base_url, enabled, is_default, created_at
    from ai_models
    where enabled = true and is_default = true
    limit 1
  `);
  if (rows.length) return (rows[0] as unknown) as AIModel;

  // fallback to first enabled
  const fallback = await db.execute(sql`
    select id, name, provider, model_id, api_key, base_url, enabled, is_default, created_at
    from ai_models
    where enabled = true
    limit 1
  `);
  return fallback.length ? ((fallback[0] as unknown) as AIModel) : null;
}

// ================================
// GET MODEL BY ID
// ================================
export async function getModelById(id: string): Promise<AIModel | null> {
  const rows = await db.execute(sql`
    select id, name, provider, model_id, api_key, base_url, enabled, is_default, created_at
    from ai_models
    where id = ${id}
    limit 1
  `);
  return rows.length ? ((rows[0] as unknown) as AIModel) : null;
}

// ================================
// CREATE MODEL
// ================================
export async function createModel(data: {
  name: string;
  provider: string;
  model_id: string;
  api_key: string;
  base_url: string;
  is_default: boolean;
}) {
  const id = randomUUID();

  // If setting as default, unset others first
  if (data.is_default) {
    await db.execute(sql`update ai_models set is_default = false`);
  }

  await db.execute(sql`
    insert into ai_models (id, name, provider, model_id, api_key, base_url, enabled, is_default)
    values (${id}, ${data.name}, ${data.provider}, ${data.model_id}, ${data.api_key}, ${data.base_url}, true, ${data.is_default})
  `);

  return { id };
}

// ================================
// UPDATE MODEL
// ================================
export async function updateModel(id: string, data: {
  name?: string;
  provider?: string;
  model_id?: string;
  api_key?: string;
  base_url?: string;
  enabled?: boolean;
  is_default?: boolean;
}) {
  if (data.is_default) {
    await db.execute(sql`update ai_models set is_default = false`);
  }

  await db.execute(sql`
    update ai_models set
      name = coalesce(${data.name ?? null}, name),
      provider = coalesce(${data.provider ?? null}, provider),
      model_id = coalesce(${data.model_id ?? null}, model_id),
      api_key = coalesce(${data.api_key ?? null}, api_key),
      base_url = coalesce(${data.base_url ?? null}, base_url),
      enabled = coalesce(${data.enabled ?? null}, enabled),
      is_default = coalesce(${data.is_default ?? null}, is_default)
    where id = ${id}
  `);
}

// ================================
// DELETE MODEL
// ================================
export async function deleteModel(id: string) {
  await db.execute(sql`delete from ai_models where id = ${id}`);
}