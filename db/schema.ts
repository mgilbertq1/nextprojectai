import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  password_hash: text('password_hash').notNull(),
  role: text('role').notNull(),
  banned: boolean('banned').notNull().default(false),
  created_at: timestamp('created_at').notNull(),
})

export const chats = pgTable('chats', {
  id: uuid('id').primaryKey(),
  user_id: uuid('user_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  created_at: timestamp('created_at').notNull(),
})

export const memories = pgTable('memories', {
  id: uuid('id').primaryKey(),
  user_id: uuid('user_id').notNull(),
  content: text('content').notNull(),
  updated_at: timestamp('updated_at').notNull(),
})

export const preferences = pgTable('preferences', {
  user_id: uuid('user_id').primaryKey(),
  config: jsonb('config').notNull(),
})

export const systemFlags = pgTable('system_flags', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const usageLogs = pgTable('usage_logs', {
  id: uuid('id').primaryKey(),
  user_id: uuid('user_id'),
  tokens: integer('tokens').notNull(),
  endpoint: text('endpoint').notNull(),
  created_at: timestamp('created_at').notNull(),
})
