'use client'

import { motion } from 'framer-motion'

export interface DonutSlice {
  key: string
  label: string
  count: number
  /** same hex in light + dark — these are fixed status tokens, never themed */
  color: string
}

const SIZE = 168
const STROKE = 22
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP_PX = 3

export default function StatusDonutChart({ slices }: { slices: DonutSlice[] }) {
  const total = slices.reduce((sum, s) => sum + s.count, 0)
  const nonZero = slices.filter((s) => s.count > 0)

  let cumulative = 0

  return (
    <div className="flex items-center gap-6 flex-wrap sm:flex-nowrap">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            fill="none" stroke="currentColor" strokeWidth={STROKE}
            className="text-[#F3F4F6] dark:text-[#242424]"
          />
          {total > 0 && nonZero.map((s) => {
            const fraction = s.count / total
            const rawLength = fraction * CIRCUMFERENCE
            const dash = Math.max(rawLength - GAP_PX, 0)
            const offset = -cumulative
            cumulative += rawLength
            return (
              <motion.circle
                key={s.key}
                cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
                fill="none" stroke={s.color} strokeWidth={STROKE} strokeLinecap="butt"
                initial={{ strokeDasharray: `0 ${CIRCUMFERENCE}`, strokeDashoffset: offset }}
                whileInView={{ strokeDasharray: `${dash} ${CIRCUMFERENCE - dash}`, strokeDashoffset: offset }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
              >
                <title>{s.label}: {s.count} ({Math.round(fraction * 100)}%)</title>
              </motion.circle>
            )
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-[#0A0A0A] dark:text-white">{total}</span>
          <span className="text-[11px] text-[#9CA3AF]">tasks</span>
        </div>
      </div>

      <div className="flex-1 min-w-[180px] space-y-2">
        {slices.map((s) => (
          <div key={s.key} className="flex items-center justify-between text-[13px]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-[#0A0A0A] dark:text-white truncate">{s.label}</span>
            </div>
            <span className="text-[#9CA3AF] shrink-0 ml-3">
              {s.count} {total > 0 && <span className="text-[11px]">({Math.round((s.count / total) * 100)}%)</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
