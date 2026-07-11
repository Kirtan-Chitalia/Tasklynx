import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, query, queryOne } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await queryOne('SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2', [id, user.userId])
  if (!membership && user.role !== 'admin') return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // A task's "dependencies" are its predecessors: tasks that must complete before
  // it can start. task_dependencies stores (predecessor_id, successor_id), so for
  // each successor we aggregate its predecessor ids.
  const tasks = await query(
    `SELECT t.id, t.title, t.start_date, t.due_date AS end_date, COALESCE(t.progress, 0) AS progress, t.parent_task_id,
            u.display_name AS assignee_name,
            COALESCE(td.deps, ARRAY[]::uuid[]) AS dependencies
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assignee_id
     LEFT JOIN (
       SELECT successor_id AS task_id, array_agg(predecessor_id) AS deps
       FROM task_dependencies
       GROUP BY successor_id
     ) td ON td.task_id = t.id
     WHERE t.project_id = $1
     ORDER BY t.start_date NULLS LAST, t.due_date NULLS LAST`,
    [id]
  )

  return NextResponse.json({ tasks })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await queryOne('SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2', [id, user.userId])
  if (!membership && user.role !== 'admin') return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const body = await req.json()
  const { taskId, start_date, end_date } = body || {}
  if (!taskId) return NextResponse.json({ error: 'taskId is required' }, { status: 400 })

  // Basic validation for dates — allow null to clear dates
  const start = start_date ? String(start_date) : null
  const end = end_date ? String(end_date) : null

  // Validation: ensure start <= end when both present
  if (start && end && new Date(start) > new Date(end)) {
    return NextResponse.json({ error: 'start_date must be <= end_date' }, { status: 400 })
  }

  // Validation: if task has dependencies (predecessors), ensure its start_date is
  // after the latest predecessor due_date. Predecessors are rows where this task
  // is the successor.
  const deps = await query(
    `SELECT t.due_date FROM task_dependencies td JOIN tasks t ON t.id = td.predecessor_id WHERE td.successor_id = $1 AND t.project_id = $2`,
    [taskId, id]
  )
  if (deps && deps.length && start) {
    const latestDepDue = deps
      .map((r: { due_date: string | null }) => r.due_date)
      .filter((d): d is string => Boolean(d))
      .map((d) => new Date(d).getTime())
      .reduce((max: number, cur: number) => Math.max(max, cur), 0)
    if (latestDepDue > 0 && new Date(start).getTime() < latestDepDue) {
      return NextResponse.json({ error: 'start_date must be after dependencies due dates' }, { status: 400 })
    }
  }

  await query(
    `UPDATE tasks SET start_date = $1, due_date = $2, updated_at = NOW() WHERE id = $3 AND project_id = $4`,
    [start, end, taskId, id]
  )

  return NextResponse.json({ ok: true })
}
