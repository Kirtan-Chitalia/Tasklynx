import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, query, queryOne, DEFAULT_ORG_ID } from '@/lib/db'

async function uniqueSlug(name: string) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'project'
  let slug = base
  let suffix = 2
  while (await queryOne('SELECT 1 FROM projects WHERE org_id = $1 AND slug = $2', [DEFAULT_ORG_ID, slug])) {
    slug = `${base}-${suffix}`
    suffix++
  }
  return slug
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Admins see every project in the org; everyone else only sees projects
  // they're a member of (as project_manager or developer).
  const projects = await query(
    `SELECT p.id, p.name, p.slug, p.description, p.status, p.priority,
            p.owner_id, p.created_at,
            COUNT(DISTINCT pm2.user_id)                                    AS member_count,
            COUNT(DISTINCT t.id)                                           AS task_count,
            COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'done')          AS done_task_count
     FROM projects p
     LEFT JOIN project_members pm2 ON pm2.project_id = p.id
     LEFT JOIN tasks t ON t.project_id = p.id
     WHERE p.org_id = $1
       AND ($2::uuid IS NULL OR EXISTS (
         SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2
       ))
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    [DEFAULT_ORG_ID, user.role === 'admin' ? null : user.userId]
  )

  return NextResponse.json({ projects })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, status, priority } = await req.json()
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
  }

  const validStatuses = ['planning', 'active', 'on_hold', 'completed', 'archived', 'cancelled']
  const validPriorities = ['critical', 'high', 'medium', 'low']
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }
  if (priority && !validPriorities.includes(priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
  }

  const slug = await uniqueSlug(name)

  const project = await queryOne(
    `INSERT INTO projects (org_id, name, slug, description, status, priority, owner_id, created_by)
     VALUES ($1, $2, $3, $4, COALESCE($5, 'planning'), COALESCE($6, 'medium'), $7, $7)
     RETURNING id, name, slug, description, status, priority, owner_id, created_at`,
    [DEFAULT_ORG_ID, name.trim(), slug, description || null, status, priority, user.userId]
  )

  await query(
    `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'project_manager')`,
    [(project as { id: string }).id, user.userId]
  )

  return NextResponse.json({ project }, { status: 201 })
}
