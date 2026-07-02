export const STATUS_STYLES: Record<string, string> = {
  planning: 'bg-[#f3f4f6] text-[#374151]', active: 'bg-[#f0fdf4] text-[#15803d]',
  on_hold: 'bg-[#fefce8] text-[#a16207]', completed: 'bg-[#eff6ff] text-[#1d4ed8]',
  archived: 'bg-[#f3f4f6] text-[#6b7280]', cancelled: 'bg-[#fef2f2] text-[#b91c1c]',
  todo: 'bg-[#f3f4f6] text-[#374151]', in_progress: 'bg-[#eff6ff] text-[#1d4ed8]',
  in_review: 'bg-[#fefce8] text-[#a16207]', done: 'bg-[#f0fdf4] text-[#15803d]',
}

export const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-[#fef2f2] text-[#b91c1c]', high: 'bg-[#fff7ed] text-[#c2410c]',
  medium: 'bg-[#fefce8] text-[#a16207]', low: 'bg-[#f3f4f6] text-[#6b7280]',
}
