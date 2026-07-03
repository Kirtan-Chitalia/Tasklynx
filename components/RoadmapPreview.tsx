'use client'

import { motion } from 'framer-motion'

interface RoadmapItem {
  label: string
  icon: string
  startPct: number
  widthPct: number
  milestone: string
}

const INITIATIVES: { group: string; count: number; items: { label: string; count: number }[] }[] = [
  { group: 'Core Platform', count: 34, items: [
    { label: 'Kanban engine', count: 14 },
    { label: 'Task panels', count: 11 },
    { label: 'Realtime UX', count: 9 },
  ] },
  { group: 'Team Workflows', count: 19, items: [
    { label: 'Roles & access', count: 7 },
    { label: 'Comments & activity', count: 12 },
  ] },
]

const BARS: RoadmapItem[] = [
  { label: 'Kanban engine', icon: '◫', startPct: 4, widthPct: 30, milestone: 'Drag & drop' },
  { label: 'Task panels', icon: '▤', startPct: 22, widthPct: 34, milestone: 'Inline edit' },
  { label: 'Comments & activity', icon: '◔', startPct: 40, widthPct: 30, milestone: 'Threads' },
  { label: 'Roles & access', icon: '◆', startPct: 58, widthPct: 26, milestone: 'Permissions' },
]

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG']

export default function RoadmapPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.6 }}
      className="relative max-w-5xl mx-auto rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] text-white overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
    >
      {/* month ruler */}
      <div className="flex border-b border-white/10 text-[11px] text-[#737373] px-4">
        <div className="w-[220px] shrink-0 py-3 font-medium text-white">Initiatives</div>
        <div className="flex-1 flex">
          {MONTHS.map((m) => (
            <div key={m} className="flex-1 py-3 border-l border-white/5 pl-2">{m}</div>
          ))}
        </div>
      </div>

      <div className="flex">
        {/* left sidebar */}
        <div className="w-[220px] shrink-0 border-r border-white/10">
          {INITIATIVES.map((g) => (
            <div key={g.group}>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
                <span className="text-[13px] font-medium">{g.group}</span>
                <span className="text-[11px] text-[#737373]">{g.count}</span>
              </div>
              {g.items.map((it) => (
                <div key={it.label} className="flex items-center justify-between px-4 py-2.5 pl-6 border-b border-white/5 text-[#A1A1AA]">
                  <span className="text-[12px]">{it.label}</span>
                  <span className="text-[11px] text-[#737373]">{it.count}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* timeline */}
        <div className="flex-1 relative">
          <div className="absolute inset-0 flex pointer-events-none">
            {MONTHS.map((m) => <div key={m} className="flex-1 border-l border-white/5" />)}
          </div>
          {(() => {
            const rows = INITIATIVES.flatMap((g) => [g.group, ...g.items.map((i) => i.label)])
            return rows.map((label, row) => {
              const bar = BARS.find((b) => b.label === label)
              return (
                <div key={label + row} className="h-[41px] border-b border-white/5 relative flex items-center px-2">
                  {bar && (
                    <motion.div
                      initial={{ width: 0, opacity: 0 }}
                      whileInView={{ width: `${bar.widthPct}%`, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, delay: 0.15 + row * 0.08, ease: [0.4, 0, 0.2, 1] }}
                      style={{ marginLeft: `${bar.startPct}%` }}
                      className="h-6 rounded-md bg-gradient-to-r from-[#E5002B]/70 to-[#E5002B]/30 border border-[#E5002B]/50 flex items-center px-2 relative"
                    >
                      <span className="text-[10px] whitespace-nowrap text-white/90">{bar.icon} {bar.milestone}</span>
                      <motion.span
                        className="absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#E5002B]"
                        animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: row * 0.3 }}
                      />
                    </motion.div>
                  )}
                </div>
              )
            })
          })()}
        </div>
      </div>
    </motion.div>
  )
}
