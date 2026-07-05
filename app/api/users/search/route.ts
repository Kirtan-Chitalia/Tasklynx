import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, query, DEFAULT_ORG_ID } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim() || ''
  if (!q) return NextResponse.json({ users: [] })

  const users = await query(
    `SELECT id, email, display_name FROM users
     WHERE org_id = $1 AND (display_name ILIKE $2 OR email ILIKE $2)
     ORDER BY display_name ASC LIMIT 10`,
    [DEFAULT_ORG_ID, `%${q.replace(/[%_]/g, '\\$&')}%`]
  )

  return NextResponse.json({ users })
}
