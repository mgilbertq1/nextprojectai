import { FastifyRequest, FastifyReply } from 'fastify'
import { db } from '@/db/drizzle'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { verifyAccessToken } from '@/config/jwt'

export async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply
) {
const token = request.cookies?.access_token

if (!token) {
  return reply.status(401).send({ error: 'Unauthorized' })
}

const payload = verifyAccessToken(token)

if (!payload || !payload.user_id) {
  return reply.status(401).send({ error: 'Invalid token' })
}


  const user = await db
    .select({
      id: users.id,
      role: users.role,
      banned: users.banned,
    })
    .from(users)
    .where(eq(users.id, payload.user_id))
    .limit(1)

  if (user.length === 0) {
    return reply.status(401).send({ error: 'User not found' })
  }

  if (user[0].banned) {
    return reply.status(403).send({ error: 'User banned' })
  }

  request.user = {
    id: user[0].id,
    role: user[0].role,
  }
}
