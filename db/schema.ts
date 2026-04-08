import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
  bigint,
  pgEnum,
} from 'drizzle-orm/pg-core'

// ─── Existing tables (unchanged) ─────────────────────────────────────────────

export const users = pgTable('users', {
  id:            uuid('id').primaryKey(),
  email:         text('email').notNull(),
  password_hash: text('password_hash').notNull(),
  role:          text('role').notNull(),
  banned:        boolean('banned').notNull().default(false),
  created_at:    timestamp('created_at').notNull(),
})

export const chats = pgTable('chats', {
  id:         uuid('id').primaryKey(),
  user_id:    uuid('user_id').notNull(),
  role:       text('role').notNull(),
  content:    text('content').notNull(),
  image_url:  text('image_url'),
  created_at: timestamp('created_at').notNull(),
})

export const memories = pgTable('memories', {
  id:         uuid('id').primaryKey(),
  user_id:    uuid('user_id').notNull(),
  content:    text('content').notNull(),
  updated_at: timestamp('updated_at').notNull(),
})

export const preferences = pgTable('preferences', {
  user_id: uuid('user_id').primaryKey(),
  config:  jsonb('config').notNull(),
})

export const systemFlags = pgTable('system_flags', {
  key:   text('key').primaryKey(),
  value: text('value').notNull(),
})

export const usageLogs = pgTable('usage_logs', {
  id:         uuid('id').primaryKey(),
  user_id:    uuid('user_id'),
  tokens:     integer('tokens').notNull(),
  endpoint:   text('endpoint').notNull(),
  created_at: timestamp('created_at').notNull(),
})

// ─── Support Tickets ──────────────────────────────────────────────────────────

export const ticketPriorityEnum = pgEnum('ticket_priority', ['low', 'medium', 'high'])
export const ticketStatusEnum   = pgEnum('ticket_status',   ['open', 'in_progress', 'resolved', 'closed'])

export const supportTickets = pgTable('support_tickets', {
  id:          uuid('id').primaryKey().defaultRandom(),
  user_id:     uuid('user_id').notNull(),
  user_email:  text('user_email').notNull(),
  user_name:   text('user_name'),
  subject:     text('subject').notNull(),
  message:     text('message').notNull(),
  priority:    ticketPriorityEnum('priority').notNull().default('medium'),
  status:      ticketStatusEnum('status').notNull().default('open'),
  assigned_to: text('assigned_to'),
  admin_notes: text('admin_notes'),
  created_at:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  resolved_at: timestamp('resolved_at', { withTimezone: true }),
})

export const ticketAttachments = pgTable('ticket_attachments', {
  id:           uuid('id').primaryKey().defaultRandom(),
  ticket_id:    uuid('ticket_id').notNull(),
  file_name:    text('file_name').notNull(),
  file_size:    bigint('file_size', { mode: 'number' }).notNull(),
  file_type:    text('file_type').notNull(),
  storage_path: text('storage_path').notNull(),
  uploaded_at:  timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
})

export const ticketReplies = pgTable('ticket_replies', {
  id:          uuid('id').primaryKey().defaultRandom(),
  ticket_id:   uuid('ticket_id').notNull(),
  sender_id:   text('sender_id').notNull(),
  sender_role: text('sender_role').notNull(), // 'user' | 'admin'
  message:     text('message').notNull(),
  created_at:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Inferred types ───────────────────────────────────────────────────────────
export type SupportTicket    = typeof supportTickets.$inferSelect
export type NewSupportTicket = typeof supportTickets.$inferInsert
export type TicketAttachment = typeof ticketAttachments.$inferSelect
export type TicketReply      = typeof ticketReplies.$inferSelect