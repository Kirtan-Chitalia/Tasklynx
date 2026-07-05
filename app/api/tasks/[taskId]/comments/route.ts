import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, query, queryOne } from '@/lib/db'

async function getTaskWithMembership(taskId: string, userId: string) {
  return queryOne<{ project_id: string; role: string | null }>(
    `SELECT t.project_id, pm.role
     FROM tasks t
     LEFT JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = $2
     WHERE t.id = $1`,
    [taskId, userId]
  )
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const context = await getTaskWithMembership(taskId, user.userId)
  if (!context || (!context.role && user.role !== 'admin')) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const comments = await query(
    `SELECT c.id, c.task_id, c.user_id, c.message, c.created_at,
            u.display_name AS user_name
     FROM task_comments c JOIN users u ON u.id = c.user_id
     WHERE c.task_id = $1
     ORDER BY c.created_at ASC`,
    [taskId]
  )

  return NextResponse.json({ comments })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Any project member — project_manager, developer, or viewer — can comment.
  const context = await getTaskWithMembership(taskId, user.userId)
  if (!context || (!context.role && user.role !== 'admin')) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const { message } = await req.json()
  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Comment message is required' }, { status: 400 })
  }

  const comment = await queryOne(
    `WITH inserted AS (
       INSERT INTO task_comments (task_id, user_id, message)
       VALUES ($1, $2, $3)
       RETURNING id, task_id, user_id, message, created_at
     )
     SELECT inserted.*, u.display_name AS user_name
     FROM inserted JOIN users u ON u.id = inserted.user_id`,
    [taskId, user.userId, message.trim()]
  )

  return NextResponse.json({ comment }, { status: 201 })
}
