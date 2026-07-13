 'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { parseISO, differenceInCalendarDays, format } from 'date-fns'

interface GanttTask {
  id: string
  title: string
  start_date?: string | null
  end_date?: string | null
  progress: number
  parent_task_id?: string | null
  assignee_name?: string | null
  dependencies?: string[]
}

export default function GanttView({ projectId }: { projectId: string }) {
  const [tasks, setTasks] = useState<GanttTask[]>([])
  const [loading, setLoading] = useState(false)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const dragRef = useRef<{
    type: 'move' | 'resize-left' | 'resize-right'
    taskId: string
    startX: number
    origOffset: number
    origWidth: number
    prevSnapshot: GanttTask[]
  } | null>(null)

  

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    void fetch(`/api/projects/${projectId}/gantt`)
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks || []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [projectId])

  const { minDate, maxDate, daysSpan } = useMemo(() => {
    const all = tasks.flatMap(t => {
      const start = t.start_date ? parseISO(t.start_date) : (t.end_date ? parseISO(t.end_date) : new Date())
      const end = t.end_date ? parseISO(t.end_date) : start
      return [start, end]
    })
    const min = all.length ? new Date(Math.min(...all.map((d) => d.getTime()))) : new Date()
    const max = all.length ? new Date(Math.max(...all.map((d) => d.getTime()))) : new Date(min.getTime() + 7 * 24 * 3600 * 1000)
    const minPadded = new Date(min.getTime() - 3 * 24 * 3600 * 1000)
    const maxPadded = new Date(max.getTime() + 7 * 24 * 3600 * 1000)
    const span = Math.max(1, differenceInCalendarDays(maxPadded, minPadded) + 1)
    return { minDate: minPadded, maxDate: maxPadded, daysSpan: span }
  }, [tasks])

  const dayWidth = 12 // px per day
  const rowHeight = 48

  const idToIndex = useMemo(() => {
    const m = new Map<string, number>()
    tasks.forEach((t, i) => m.set(t.id, i))
    return m
  }, [tasks])

  const performUpdate = async (newTasks: GanttTask[], taskId: string, prevSnapshot: GanttTask[]) => {
    setTasks(newTasks)
    const task = newTasks.find((t) => t.id === taskId)
    if (!task) return
    try {
      const res = await fetch(`/api/projects/${projectId}/gantt`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, start_date: task.start_date, end_date: task.end_date })
      })
      if (!res.ok) setTasks(prevSnapshot)
    } catch {
      setTasks(prevSnapshot)
    }
  }

  const handleKey = (e: any, t: GanttTask) => {
    const days = e.shiftKey ? 7 : 1
    let updated: GanttTask[] | null = null
    const prev = JSON.parse(JSON.stringify(tasks)) as GanttTask[]
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const delta = e.key === 'ArrowRight' ? days : -days
      if (e.altKey) {
        // resize-left
        const start = t.start_date ? new Date(t.start_date) : (t.end_date ? new Date(t.end_date) : new Date())
        const end = t.end_date ? new Date(t.end_date) : start
        const newStart = new Date(start.getTime() + delta * 24 * 3600 * 1000)
        if (newStart <= end) {
          updated = tasks.map((x) => x.id === t.id ? { ...x, start_date: newStart.toISOString() } : x)
        }
      } else if (e.ctrlKey || e.metaKey) {
        // resize-right
        const start = t.start_date ? new Date(t.start_date) : (t.end_date ? new Date(t.end_date) : new Date())
        const end = t.end_date ? new Date(t.end_date) : start
        const newEnd = new Date(end.getTime() + delta * 24 * 3600 * 1000)
        if (newEnd >= start) {
          updated = tasks.map((x) => x.id === t.id ? { ...x, end_date: newEnd.toISOString() } : x)
        }
      } else {
        // move
        const start = t.start_date ? new Date(t.start_date) : (t.end_date ? new Date(t.end_date) : new Date())
        const end = t.end_date ? new Date(t.end_date) : start
        const newStart = new Date(start.getTime() + delta * 24 * 3600 * 1000)
        const newEnd = new Date(end.getTime() + delta * 24 * 3600 * 1000)
        updated = tasks.map((x) => x.id === t.id ? { ...x, start_date: newStart.toISOString(), end_date: newEnd.toISOString() } : x)
      }
    }
    if (updated) {
      e.preventDefault()
      void performUpdate(updated, t.id, prev)
    }
  }

  useEffect(() => {
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const deltaX = ev.pageX - dragRef.current.startX
      const deltaDays = Math.round(deltaX / dayWidth)
      setTasks((prev) => prev.map((t) => {
        if (t.id !== dragRef.current!.taskId) return t
        const newOffset = Math.max(0, dragRef.current!.origOffset + (dragRef.current!.type === 'resize-left' ? deltaDays : (dragRef.current!.type === 'move' ? deltaDays : 0)))
        const newWidth = Math.max(1, dragRef.current!.origWidth + (dragRef.current!.type === 'resize-right' ? deltaDays : (dragRef.current!.type === 'resize-left' ? -deltaDays : 0)))
        const start = new Date(minDate.getTime() + newOffset * 24 * 3600 * 1000)
        const end = new Date(start.getTime() + (newWidth - 1) * 24 * 3600 * 1000)
        // update tooltip near cursor
        setTooltip({ x: ev.pageX, y: ev.pageY - 24, text: `${format(start, 'MMM d')} — ${format(end, 'MMM d')}` })
        return { ...t, start_date: start.toISOString(), end_date: end.toISOString() }
      }))
    }

    const onUp = async () => {
      if (!dragRef.current) return
      const d = dragRef.current
      const task = tasks.find((x) => x.id === d.taskId)
      const prev = d.prevSnapshot
      dragRef.current = null
      setTooltip(null)
      if (!task) return
      try {
        const res = await fetch(`/api/projects/${projectId}/gantt`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: task.id, start_date: task.start_date, end_date: task.end_date })
        })
        if (!res.ok) {
          // rollback optimistic changes
          setTasks(prev)
        }
      } catch (err) {
        setTasks(prev)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [projectId, tasks, minDate])

  return (
    <div>
      {loading && <div className="text-sm text-gray-500">Loading Gantt…</div>}
      {!loading && (
        <div className="overflow-auto border rounded">
          <div className="px-2 py-2 bg-gray-50 flex gap-2 sticky top-0">
            <div className="w-64 font-medium">Task</div>
            <div className="flex-1" style={{ minWidth: daysSpan * dayWidth }}>{format(minDate, 'MMM d')} — {format(maxDate, 'MMM d')}</div>
          </div>

          <div className="relative">
            <svg className="absolute left-64 top-0 pointer-events-none" width={Math.max(1, daysSpan * dayWidth)} height={tasks.length * rowHeight}>
              <defs>
                <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 z" fill="#9CA3AF" />
                </marker>
              </defs>
              {tasks.map((t, i) => {
                if (!t.dependencies || !t.dependencies.length) return null
                const toX = Math.round(Math.max(0, (differenceInCalendarDays(t.start_date ? parseISO(t.start_date) : (t.end_date ? parseISO(t.end_date) : new Date()), minDate))) * dayWidth)
                const toY = i * rowHeight + rowHeight / 2
                return t.dependencies.map((depId) => {
                  const depIndex = idToIndex.get(depId)
                  if (depIndex === undefined) return null
                  const dep = tasks[depIndex]
                  const depStart = dep.start_date ? parseISO(dep.start_date) : (dep.end_date ? parseISO(dep.end_date) : new Date())
                  const depEnd = dep.end_date ? parseISO(dep.end_date) : depStart
                  const depEndX = Math.round((differenceInCalendarDays(depEnd, minDate) + 1) * dayWidth)
                  const depY = depIndex * rowHeight + rowHeight / 2
                  const midX = Math.max(depEndX + 8, (depEndX + toX) / 2)
                  return (
                    <polyline key={`${t.id}-${depId}`} points={`${depEndX},${depY} ${midX},${depY} ${midX},${toY} ${toX},${toY}`} fill="none" stroke="#9CA3AF" strokeWidth={1.2} markerEnd="url(#arrow)" />
                  )
                })
              })}
            </svg>
            {tasks.map((t) => {
              const hasExplicitDates = t.start_date != null || t.end_date != null
              const start = t.start_date ? parseISO(t.start_date) : (t.end_date ? parseISO(t.end_date) : new Date())
              const end = t.end_date ? parseISO(t.end_date) : start
              const offset = Math.max(0, differenceInCalendarDays(start, minDate))
              const width = Math.max(1, differenceInCalendarDays(end, start) + 1)
              return (
                <div key={t.id} className="flex items-center gap-2 px-2 py-2 border-t" style={{ height: rowHeight }}>
                  <div className="w-64 text-sm">
                    <div className="font-medium truncate">{t.title}</div>
                    <div className="text-xs text-gray-500">{t.assignee_name || 'Unassigned'}</div>
                  </div>
                  <div className="flex-1" style={{ minWidth: daysSpan * dayWidth }}>
                    <div className="relative h-8">
                      <div className="absolute left-0 top-2 h-4 w-full bg-transparent">
                        <div
                          className={`absolute top-0 h-4 rounded ${hasExplicitDates ? 'bg-blue-500' : 'bg-[#9CA3AF] border border-[#6B7280] border-dashed'}`}
                          style={{ left: offset * dayWidth, width: width * dayWidth, opacity: hasExplicitDates ? 0.95 : 0.6 }}
                        >
                          <div
                            tabIndex={0}
                            onKeyDown={(e) => handleKey(e, t)}
                            onMouseDown={(ev) => {
                              // move whole bar
                              dragRef.current = { type: 'move', taskId: t.id, startX: ev.pageX, origOffset: offset, origWidth: width, prevSnapshot: JSON.parse(JSON.stringify(tasks)) }
                              ev.preventDefault()
                            }}
                            className="absolute inset-0 cursor-grab"
                          />
                          <div
                            onMouseDown={(ev) => {
                              // left resize
                              dragRef.current = { type: 'resize-left', taskId: t.id, startX: ev.pageX, origOffset: offset, origWidth: width, prevSnapshot: JSON.parse(JSON.stringify(tasks)) }
                              ev.stopPropagation(); ev.preventDefault()
                            }}
                            className="absolute left-0 top-0 h-full w-2 cursor-ew-resize"
                          />
                          <div
                            onMouseDown={(ev) => {
                              // right resize
                              dragRef.current = { type: 'resize-right', taskId: t.id, startX: ev.pageX, origOffset: offset, origWidth: width, prevSnapshot: JSON.parse(JSON.stringify(tasks)) }
                              ev.stopPropagation(); ev.preventDefault()
                            }}
                            className="absolute right-0 top-0 h-full w-2 cursor-ew-resize"
                          />
                        </div>
                        <div
                          className="absolute top-0 h-4 bg-green-600 rounded"
                          style={{ left: (offset * dayWidth) + (width * dayWidth) * (t.progress / 100), width: 2 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            {tooltip && (
              <div style={{ position: 'fixed', left: tooltip.x + 8, top: tooltip.y, background: 'rgba(0,0,0,0.8)', color: 'white', padding: '4px 8px', borderRadius: 4, fontSize: 12 }}>
                {tooltip.text}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
