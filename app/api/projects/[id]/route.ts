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

  const project = await queryOne(
    `SELECT id, name, slug, description, status, priority, deadline, owner_id, created_by, created_at, updated_at
     FROM projects WHERE id = $1`,
    [id]
  )
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const members = await query(
    `SELECT pm.user_id, pm.role, pm.joined_at, u.email, u.display_name
     FROM project_members pm JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = $1 ORDER BY pm.joined_at ASC`,
    [id]
  )

  return NextResponse.json({ project, members, myRole: membership?.role ?? 'admin' })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await getMembership(id, user.userId)
  if (!membership && user.role !== 'admin') return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (user.role !== 'admin' && membership?.role !== 'project_manager') {
    return NextResponse.json({ error: 'Only project managers can edit this project' }, { status: 403 })
  }

  const { name, description, status, priority, deadline } = await req.json()
  const validStatuses = ['planning', 'active', 'on_hold', 'completed', 'archived', 'cancelled']
  const validPriorities = ['critical', 'high', 'medium', 'low']
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }
  if (priority && !validPriorities.includes(priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
  }

  // deadline: undefined = leave unchanged, null/'' = clear, otherwise set.
  const deadlineProvided = deadline !== undefined
  const deadlineValue = deadline ? String(deadline) : null

  const project = await queryOne(
    `UPDATE projects SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        status = COALESCE($4, status),
        priority = COALESCE($5, priority),
        deadline = CASE WHEN $7 THEN $6 ELSE deadline END,
        updated_at = NOW()
     WHERE id = $1
     RETURNING id, name, slug, description, status, priority, deadline, owner_id, created_at, updated_at`,
    [id, name, description, status, priority, deadlineValue, deadlineProvided]
  )

  return NextResponse.json({ project })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await getMembership(id, user.userId)
  if (!membership && user.role !== 'admin') return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (user.role !== 'admin' && membership?.role !== 'project_manager') {
    return NextResponse.json({ error: 'Only project managers can delete this project' }, { status: 403 })
  }

  await query('DELETE FROM projects WHERE id = $1', [id])
  return NextResponse.json({ message: 'Project deleted' })
}
