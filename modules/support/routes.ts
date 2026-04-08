// modules/support/routes.ts
import { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { eq, desc } from 'drizzle-orm'
import { db } from '../../db/drizzle'
import {
  supportTickets,
  ticketAttachments,
  ticketReplies,
  users,
} from '../../db/schema'
import { env } from '../../config/env'
import { requireUser, requireAdmin } from '../../middleware/requireUser'
import { sendReplyEmail, sendConfirmEmail } from './emailService'

// Supabase hanya untuk Storage uploads — DB tetap lewat Drizzle
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
const BUCKET = 'ticket-attachments'
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

export async function supportRoutes(fastify: FastifyInstance) {

  // ── POST /support/tickets ──────────────────────────────────────────────────
  fastify.post('/support/tickets', { preHandler: [requireUser] }, async (req, reply) => {
    const user = (req as any).user as { id: string; role: string }
    const { subject, message, priority = 'medium' } = req.body as {
      subject:   string
      message:   string
      priority?: 'low' | 'medium' | 'high'
    }

    if (!subject?.trim() || !message?.trim()) {
      return reply.status(400).send({ error: 'subject and message are required' })
    }

    // Ambil email dari tabel users
    const [userData] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)

    if (!userData) {
      return reply.status(500).send({ error: 'Could not fetch user info' })
    }

    const [ticket] = await db
      .insert(supportTickets)
      .values({
        user_id:    user.id,
        user_email: userData.email,
        user_name:  null,
        subject:    subject.trim(),
        message:    message.trim(),
        priority:   priority as any,
      })
      .returning()

    sendConfirmEmail({
      toEmail:       ticket.user_email,
      toName:        ticket.user_name,
      ticketId:      ticket.id,
      ticketSubject: ticket.subject,
      priority:      ticket.priority,
    }).catch((err) => fastify.log.error({ err }, 'confirm email failed'))

    return reply.status(201).send({ ticket })
  })

  // ── POST /support/tickets/:id/attachments ──────────────────────────────────
  fastify.post('/support/tickets/:id/attachments', { preHandler: [requireUser] }, async (req, reply) => {
    const user             = (req as any).user as { id: string; role: string }
    const { id: ticketId } = req.params as { id: string }

    const [ticket] = await db
      .select({ id: supportTickets.id, user_id: supportTickets.user_id })
      .from(supportTickets)
      .where(eq(supportTickets.id, ticketId))
      .limit(1)

    if (!ticket) return reply.status(404).send({ error: 'Ticket not found' })
    if (ticket.user_id !== user.id && user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })

    const chunks: Buffer[] = []
    let totalSize = 0
    for await (const chunk of data.file) {
      totalSize += chunk.length
      if (totalSize > MAX_FILE_SIZE) {
        return reply.status(413).send({ error: 'File too large (max 20MB)' })
      }
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    // Sanitize filename — hapus karakter non-ASCII, spasi → underscore
    const ext           = data.filename.split('.').pop() ?? 'bin'
    const baseName      = data.filename.replace(/\.[^/.]+$/, '')   // tanpa ekstensi
    const safeBaseName  = baseName
      .replace(/[^\x00-\x7F]/g, '')   // hapus non-ASCII (emoji, unicode)
      .replace(/[^a-zA-Z0-9._-]/g, '_') // ganti karakter aneh dengan _
      .replace(/_+/g, '_')              // collapse multiple underscore
      .replace(/^_|_$/g, '')            // trim underscore di awal/akhir
      || 'file'                         // fallback kalau nama jadi kosong
    const safeFilename  = `${safeBaseName}.${ext}`

    const storagePath = `${ticketId}/${Date.now()}-${safeFilename}`
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: data.mimetype, upsert: false })

    if (uploadError) {
      fastify.log.error({ uploadError }, 'Storage upload failed')
      return reply.status(500).send({ error: 'File upload failed' })
    }

    const [attachment] = await db
      .insert(ticketAttachments)
      .values({
        ticket_id:    ticketId,
        file_name:    safeFilename,   // pakai nama yang sudah disanitize
        file_size:    totalSize,
        file_type:    data.mimetype,
        storage_path: storagePath,
      })
      .returning()

    return reply.status(201).send({ attachment })
  })

  // ── GET /support/tickets ───────────────────────────────────────────────────
  fastify.get('/support/tickets', { preHandler: [requireUser] }, async (req, reply) => {
    const user = (req as any).user as { id: string }

    const tickets = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.user_id, user.id))
      .orderBy(desc(supportTickets.created_at))

    return reply.send({ tickets })
  })

  // ── GET /support/tickets/:id ───────────────────────────────────────────────
  fastify.get('/support/tickets/:id', { preHandler: [requireUser] }, async (req, reply) => {
    const user   = (req as any).user as { id: string; role: string }
    const { id } = req.params as { id: string }

    const [ticket] = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, id))
      .limit(1)

    if (!ticket) return reply.status(404).send({ error: 'Ticket not found' })
    if (ticket.user_id !== user.id && user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const attachmentsRaw = await db
      .select()
      .from(ticketAttachments)
      .where(eq(ticketAttachments.ticket_id, id))

    const attachments = await Promise.all(
      attachmentsRaw.map(async (att) => {
        const { data } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(att.storage_path, 3600)
        return { ...att, signedUrl: data?.signedUrl ?? null }
      })
    )

    const replies = await db
      .select()
      .from(ticketReplies)
      .where(eq(ticketReplies.ticket_id, id))
      .orderBy(ticketReplies.created_at)

    return reply.send({ ticket, attachments, replies })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  // ── GET /admin/support/tickets ─────────────────────────────────────────────
  fastify.get('/admin/support/tickets', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { status } = req.query as { status?: string }

    const tickets = await db
      .select()
      .from(supportTickets)
      .where(status ? eq(supportTickets.status, status as any) : undefined)
      .orderBy(desc(supportTickets.created_at))

    return reply.send({ tickets })
  })

  // ── GET /admin/support/tickets/:id ────────────────────────────────────────
  fastify.get('/admin/support/tickets/:id', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const [ticket] = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, id))
      .limit(1)

    if (!ticket) return reply.status(404).send({ error: 'Ticket not found' })

    const attachmentsRaw = await db
      .select()
      .from(ticketAttachments)
      .where(eq(ticketAttachments.ticket_id, id))

    const attachments = await Promise.all(
      attachmentsRaw.map(async (att) => {
        const { data } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(att.storage_path, 3600)
        return { ...att, signedUrl: data?.signedUrl ?? null }
      })
    )

    const replies = await db
      .select()
      .from(ticketReplies)
      .where(eq(ticketReplies.ticket_id, id))
      .orderBy(ticketReplies.created_at)

    return reply.send({ ticket, attachments, replies })
  })

  // ── PATCH /admin/support/tickets/:id ──────────────────────────────────────
  fastify.patch('/admin/support/tickets/:id', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { status, assigned_to, admin_notes } = req.body as {
      status?:       'open' | 'in_progress' | 'resolved' | 'closed'
      assigned_to?:  string
      admin_notes?:  string
    }

    const updates: Partial<typeof supportTickets.$inferInsert> = {
      updated_at: new Date(),
    }
    if (status)                     updates.status      = status as any
    if (assigned_to)                updates.assigned_to = assigned_to
    if (admin_notes !== undefined)  updates.admin_notes = admin_notes
    if (status === 'resolved')      updates.resolved_at = new Date()

    const [updated] = await db
      .update(supportTickets)
      .set(updates)
      .where(eq(supportTickets.id, id))
      .returning()

    if (!updated) return reply.status(404).send({ error: 'Ticket not found' })

    return reply.send({ ticket: updated })
  })

  // ── POST /admin/support/tickets/:id/reply ─────────────────────────────────
  fastify.post('/admin/support/tickets/:id/reply', { preHandler: [requireAdmin] }, async (req, reply) => {
    const admin  = (req as any).user as { id: string }
    const { id } = req.params as { id: string }
    const { message } = req.body as { message: string }

    if (!message?.trim()) {
      return reply.status(400).send({ error: 'message is required' })
    }

    const [ticket] = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, id))
      .limit(1)

    if (!ticket) return reply.status(404).send({ error: 'Ticket not found' })

    const [replyRecord] = await db
      .insert(ticketReplies)
      .values({
        ticket_id:   id,
        sender_id:   admin.id,
        sender_role: 'admin',
        message:     message.trim(),
      })
      .returning()

    // Auto open → in_progress
    if (ticket.status === 'open') {
      await db
        .update(supportTickets)
        .set({ status: 'in_progress' as any, updated_at: new Date() })
        .where(eq(supportTickets.id, id))
    }

    // Kirim email via Resend
    await sendReplyEmail({
      toEmail:         ticket.user_email,
      toName:          ticket.user_name,
      ticketId:        ticket.id,
      ticketSubject:   ticket.subject,
      adminReply:      message.trim(),
      originalMessage: ticket.message,
    })

    return reply.send({ reply: replyRecord })
  })
}