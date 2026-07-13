'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { PRIORITY_DOT } from '@/lib/badges'
import Avatar from '@/components/Avatar'

export interface KanbanTask {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  story_points: number
  due_date: string | null
  start_date: string | null
  assignee_id: string | null
  assignee_name: string | null
}

interface TaskCardProps {
  task: KanbanTask
  onOpen: (task: KanbanTask) => void
  dimmed: boolean
}

export default function TaskCard({ task, onOpen, dimmed }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, data: { task } })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0 : dimmed ? 0.6 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(task) }}
      role="button"
      tabIndex={0}
      aria-label={`Open task ${task.title}`}
      className="bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg p-3 cursor-pointer transition-all duration-150 hover:shadow-[0_4px_12px_rgba(0,0,0,0.10)] hover:-translate-y-px"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`} />
        <span className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] capitalize">{task.priority}</span>
        <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#FEF2F2] text-[#E5002B] dark:bg-[#2a1010] dark:text-[#FF4D6D]">
          {task.story_points} SP
        </span>
      </div>

      <p className="text-[13px] font-medium text-[#0A0A0A] dark:text-white mb-1 leading-snug">{task.title}</p>
      {task.description && (
        <p className="text-[12px] text-[#6B7280] dark:text-[#9CA3AF] truncate mb-2.5">{task.description}</p>
      )}

      <div className="flex items-center justify-between mt-2">
        {task.assignee_id ? (
          <Avatar userId={task.assignee_id} name={task.assignee_name} size={22} />
        ) : (
          <span className="text-[11px] text-[#9CA3AF]">Unassigned</span>
        )}
        {(task.start_date || task.due_date) && (
          <span className="text-[11px] text-[#9CA3AF] flex items-center gap-1">
            📅 {task.start_date ? new Date(task.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
            {task.start_date && task.due_date ? ' - ' : ''}
            {task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
          </span>
        )}
      </div>
    </div>
  )
}
