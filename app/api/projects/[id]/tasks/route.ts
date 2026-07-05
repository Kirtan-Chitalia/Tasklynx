import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, query, queryOne } from '@/lib/db'

async function getMembership(projectId: string, userId: string) {
  return queryOne<{ role: string }>(
    'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, userId]
  )
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await getMembership(id, user.userId)
  if (!membership && user.role !== 'admin') return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const tasks = await query(
    `SELECT t.id, t.title, t.description, t.status, t.priority, t.story_points, t.due_date,
            t.assignee_id, t.created_by, t.created_at, t.updated_at,
            u.display_name AS assignee_name, u.email AS assignee_email
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assignee_id
     WHERE t.project_id = $1
     ORDER BY t.created_at DESC`,
    [id]
  )

  return NextResponse.json({ tasks })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await getMembership(id, user.userId)
  if (!membership && user.role !== 'admin') return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (user.role !== 'admin' && !['project_manager', 'developer'].includes(membership?.role ?? '')) {
    return NextResponse.json({ error: 'You do not have permission to create tasks in this project' }, { status: 403 })
  }

  const { title, description, status, priority, storyPoints, dueDate, assigneeId } = await req.json()
  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'Task title is required' }, { status: 400 })
  }

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
    const assigneeMembership = await getMembership(id, assigneeId)
    if (!assigneeMembership) {
      return NextResponse.json({ error: 'Assignee must be a member of this project' }, { status: 400 })
    }
  }

  const task = await queryOne(
    `INSERT INTO tasks (project_id, title, description, status, priority, story_points, due_date, assignee_id, created_by)
     VALUES ($1, $2, $3, COALESCE($4, 'todo'), COALESCE($5, 'medium'), COALESCE($9, 3), $6, $7, $8)
     RETURNING id, title, description, status, priority, story_points, due_date, assignee_id, created_by, created_at`,
    [id, title.trim(), description || null, status, priority, dueDate || null, assigneeId || null, user.userId, storyPoints]
  )

  return NextResponse.json({ task }, { status: 201 })
}
