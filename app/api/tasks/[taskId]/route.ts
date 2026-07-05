import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, query, queryOne } from '@/lib/db'

async function getTaskWithMembership(taskId: string, userId: string) {
  return queryOne<{ project_id: string; assignee_id: string | null; role: string | null }>(
    `SELECT t.project_id, t.assignee_id, pm.role
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

  const task = await queryOne(
    `SELECT t.id, t.title, t.description, t.status, t.priority, t.story_points, t.due_date,
            t.assignee_id, t.created_by, t.created_at, t.updated_at,
            u.display_name AS assignee_name, u.email AS assignee_email
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assignee_id
     WHERE t.id = $1`,
    [taskId]
  )

  return NextResponse.json({ task })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const context = await getTaskWithMembership(taskId, user.userId)
  if (!context || (!context.role && user.role !== 'admin')) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const canEdit = user.role === 'admin' || ['project_manager', 'developer'].includes(context.role ?? '') || context.assignee_id === user.userId
  if (!canEdit) {
    return NextResponse.json({ error: 'You do not have permission to edit this task' }, { status: 403 })
  }

  const { title, description, status, priority, storyPoints, dueDate, assigneeId } = await req.json()
  const validStatuses = ['todo', 'in_progress', 'in_review', 'done', 'cancelled']
  const validPriorities = ['critical', 'high', 'medium', 'low']
  const validStoryPoints = [1, 2, 3, 5, 8, 13, 21]
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }
  if (priority && !validPriorities.includes(priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
  }
  if (storyPoints !== undefined && storyPoints !== null && !validStoryPoints.includes(storyPoints)) {
    return NextResponse.json({ error: 'Invalid story points' }, { status: 400 })
  }

  if (assigneeId) {
    const assigneeMembership = await queryOne(
      'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
      [context.project_id, assigneeId]
    )
    if (!assigneeMembership) {
      return NextResponse.json({ error: 'Assignee must be a member of this project' }, { status: 400 })
    }
  }

  const task = await queryOne(
    `UPDATE tasks SET
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        status = COALESCE($4, status),
        priority = COALESCE($5, priority),
        story_points = COALESCE($8, story_points),
        due_date = COALESCE($6, due_date),
        assignee_id = COALESCE($7, assignee_id),
        completed_at = CASE WHEN $4 = 'done' THEN NOW() ELSE completed_at END,
        updated_at = NOW()
     WHERE id = $1
     RETURNING id, title, description, status, priority, story_points, due_date, assignee_id, created_by, created_at`,
    [taskId, title, description, status, priority, dueDate, assigneeId, storyPoints]
  )

  return NextResponse.json({ task })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const context = await getTaskWithMembership(taskId, user.userId)
  if (!context || (!context.role && user.role !== 'admin')) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }
  if (user.role !== 'admin' && !['project_manager', 'developer'].includes(context.role ?? '')) {
    return NextResponse.json({ error: 'You do not have permission to delete this task' }, { status: 403 })
  }

  await query('DELETE FROM tasks WHERE id = $1', [taskId])
  return NextResponse.json({ message: 'Task deleted' })
}
