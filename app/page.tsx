'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import AnimatedNumber from '@/components/AnimatedNumber'
import RoadmapPreview from '@/components/RoadmapPreview'

const FEATURES = [
  {
    title: 'Task detail panels that feel instant',
    body: 'Click any card and a panel slides in from the edge — status, priority, story points, assignee, due date, all inline-editable. Blur to save, no save button, no page reload.',
    demo: 'panel',
  },
  {
    title: 'Kanban that responds to your hand',
    body: 'Drag a card and the whole board reacts — the destination column lights up, the card lifts and tilts, and the move lands the instant you let go.',
    demo: 'kanban',
  },
  {
    title: 'Comments, in context',
    body: "Discussion lives on the task, not in a separate thread you have to go find. Type, hit enter, it's there — with who said it and when.",
    demo: 'comments',
  },
  {
    title: 'Story points without the spreadsheet',
    body: 'Fibonacci-scale estimation baked into every card. Plan a sprint by scanning a board, not exporting a CSV.',
    demo: 'points',
  },
  {
    title: 'Find anything in one keystroke',
    body: 'Cmd+K opens a command palette that searches tasks, projects, and people at once. Stop clicking through five pages to find a task.',
    demo: 'palette',
  },
  {
    title: 'Dark mode that actually matches',
    body: "Every surface — panels, boards, popovers — switches together. It's not an afterthought toggle, it's a first-class theme.",
    demo: 'theme',
  },
  {
    title: 'Roles that actually mean something',
    body: 'Owner, manager, contributor, reviewer, observer — each sees and can do exactly what their role allows, on every project, automatically.',
    demo: 'team',
  },
  {
    title: 'Every action confirms itself',
    body: 'Move a card, add a comment, invite a teammate — a toast tells you it worked, instantly, and rolls back cleanly if it didn’t. No wondering if the click registered.',
    demo: 'toast',
  },
]

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const mvX = useMotionValue(0)
  const mvY = useMotionValue(0)
  const spX = useSpring(mvX, { stiffness: 60, damping: 20 })
  const spY = useSpring(mvY, { stiffness: 60, damping: 20 })

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = heroRef.current?.getBoundingClientRect()
    if (!rect) return
    mvX.set(e.clientX - rect.left)
    mvY.set(e.clientY - rect.top)
  }

  return (
    <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#0A0A0A] text-[#0A0A0A] dark:text-white overflow-x-clip">
      {/* Nav */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#2A2A2A]' : 'bg-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#E5002B]" />
            <span className="font-semibold tracking-tight">Tasklynx</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login"
              className="px-4 py-2 text-[13px] font-medium rounded-lg border border-transparent hover:border-[#E5E7EB] dark:hover:border-[#2A2A2A] transition-colors">
              Sign in
            </Link>
            <Link href="/login?mode=signup"
              className="px-4 py-2 bg-[#E5002B] hover:bg-[#CC0025] active:scale-[0.98] text-white text-[13px] font-medium rounded-lg transition-all duration-150">
              Create account
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section
        ref={heroRef}
        onMouseMove={handleMouseMove}
        className="relative pt-40 pb-28 px-6 overflow-hidden"
      >
        <div className="absolute inset-0 -z-10 opacity-[0.35] dark:opacity-[0.25]" style={{
          backgroundImage: 'linear-gradient(#E5E7EB 1px, transparent 1px), linear-gradient(90deg, #E5E7EB 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -z-10 w-[500px] h-[500px] rounded-full blur-3xl"
          style={{
            left: spX, top: spY,
            translateX: '-50%', translateY: '-50%',
            background: 'radial-gradient(circle, rgba(229,0,43,0.18), transparent 70%)',
          }}
        />
        <div aria-hidden className="absolute -z-10 top-[-120px] left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full blur-3xl opacity-40 animate-blob"
          style={{ background: 'radial-gradient(circle, rgba(229,0,43,0.25), transparent 65%)' }} />

        <div className="max-w-3xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white/60 dark:bg-white/5 text-[12px] text-[#6B7280] dark:text-[#9CA3AF] mb-6"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
            Built for teams that ship
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.05] mb-6"
          >
            Project management
            <br />
            that moves{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#E5002B] to-[#ff5470]">
              as fast as you do
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg text-[#6B7280] dark:text-[#9CA3AF] mb-9"
          >
            Tasklynx is a Kanban-first workspace with real-time-feeling boards, inline task
            panels, and zero clutter — every interaction animated, nothing static.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="flex items-center justify-center gap-3"
          >
            <Link href="/login?mode=signup"
              className="px-5 py-3 bg-[#E5002B] hover:bg-[#CC0025] active:scale-[0.98] text-white text-sm font-medium rounded-lg transition-all duration-150 shadow-[0_8px_24px_rgba(229,0,43,0.25)]">
              Get started free
            </Link>
            <a href="#features"
              className="px-5 py-3 border border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#0A0A0A] dark:hover:border-white text-sm font-medium rounded-lg transition-colors">
              See how it works
            </a>
          </motion.div>
        </div>

        <HeroPreview />
      </section>

      {/* Roadmap */}
      <section className="px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-10"
        >
          <h2 className="text-3xl font-semibold tracking-tight mb-3">Built in the open, shipped in order</h2>
          <p className="text-[#6B7280] dark:text-[#9CA3AF]">A live look at how the pieces you use today came together.</p>
        </motion.div>
        <RoadmapPreview />
      </section>

      {/* Marquee */}
      <div className="relative border-y border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] py-4 overflow-hidden">
        <div className="flex whitespace-nowrap animate-marquee text-[13px] font-medium text-[#9CA3AF] tracking-wide">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex shrink-0">
              {['KANBAN BOARDS', 'STORY POINTS', 'INLINE COMMENTS', 'COMMAND PALETTE', 'DARK MODE', 'DRAG & DROP', 'ROLE-BASED ACCESS', 'TASK PANELS'].map((w) => (
                <span key={w} className="mx-6 flex items-center gap-6">
                  {w} <span className="text-[#E5002B]">●</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <section className="max-w-5xl mx-auto px-6 py-20 grid grid-cols-3 gap-6 text-center">
        {[
          { label: 'Milliseconds to open a task panel', value: 0 },
          { label: 'Story point scale steps', value: 7 },
          { label: 'Static loading spinners left', value: 0 },
        ].map((s) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-4xl font-semibold mb-1"><AnimatedNumber value={s.value} /></p>
            <p className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF]">{s.label}</p>
          </motion.div>
        ))}
      </section>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-semibold tracking-tight mb-3">Everything moves. Nothing sits still.</h2>
          <p className="text-[#6B7280] dark:text-[#9CA3AF]">A handful of things Tasklynx does that a static tool can&apos;t.</p>
        </motion.div>

        <div className="space-y-24">
          {FEATURES.map((f, i) => (
            <FeatureRow key={f.title} feature={f} reversed={i % 2 === 1} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-6 py-24 overflow-hidden">
        <div aria-hidden className="absolute -z-10 inset-0 flex items-center justify-center">
          <div className="w-[700px] h-[300px] rounded-full blur-3xl opacity-30 animate-blob"
            style={{ background: 'radial-gradient(circle, rgba(229,0,43,0.3), transparent 65%)' }} />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto text-center"
        >
          <h2 className="text-3xl font-semibold tracking-tight mb-3">Ready to move faster?</h2>
          <p className="text-[#6B7280] dark:text-[#9CA3AF] mb-8">Sign in and open a board in under a minute.</p>
          <Link href="/login"
            className="inline-block px-6 py-3 bg-[#E5002B] hover:bg-[#CC0025] active:scale-[0.98] text-white text-sm font-medium rounded-lg transition-all duration-150 shadow-[0_8px_24px_rgba(229,0,43,0.25)]">
            Sign in to Tasklynx
          </Link>
        </motion.div>
      </section>

      <footer className="border-t border-[#E5E7EB] dark:border-[#2A2A2A] py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-[13px] text-[#9CA3AF]">
          <span>© {new Date().getFullYear()} Tasklynx</span>
          <span>Secured with HTTP-only session cookies</span>
        </div>
      </footer>
    </div>
  )
}

function HeroPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.25 }}
      className="relative max-w-4xl mx-auto mt-16 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#141414] shadow-[0_24px_60px_rgba(0,0,0,0.12)] overflow-hidden"
    >
      <div className="h-9 flex items-center gap-1.5 px-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#E5E7EB] dark:bg-[#2A2A2A]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#E5E7EB] dark:bg-[#2A2A2A]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#E5E7EB] dark:bg-[#2A2A2A]" />
      </div>
      <div className="grid grid-cols-3 gap-3 p-5">
        {['To Do', 'In Progress', 'Done'].map((col, ci) => (
          <div key={col}>
            <p className="text-[11px] font-medium text-[#9CA3AF] mb-2">{col}</p>
            <div className="space-y-2">
              {[0, 1].map((row) => (
                <motion.div
                  key={row}
                  className="rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#1A1A1A] p-2.5"
                  animate={ci === 1 && row === 0 ? { x: [0, 4, 0], boxShadow: ['0 0 0 rgba(0,0,0,0)', '0 8px 16px rgba(0,0,0,0.12)', '0 0 0 rgba(0,0,0,0)'] } : {}}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
                >
                  <div className="h-2 w-3/4 rounded bg-[#E5E7EB] dark:bg-[#2A2A2A] mb-2" />
                  <div className="flex items-center justify-between">
                    <span className="w-4 h-4 rounded-full bg-[#E5002B]/70" />
                    <span className="h-2 w-8 rounded bg-[#E5E7EB] dark:bg-[#2A2A2A]" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function FeatureRow({ feature, reversed }: { feature: (typeof FEATURES)[number]; reversed: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.6 }}
      className={`flex flex-col ${reversed ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-10`}
    >
      <div className="flex-1">
        <h3 className="text-2xl font-semibold tracking-tight mb-3">{feature.title}</h3>
        <p className="text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">{feature.body}</p>
      </div>
      <div className="flex-1 w-full">
        <FeatureDemo kind={feature.demo} />
      </div>
    </motion.div>
  )
}

function FeatureDemo({ kind }: { kind: string }) {
  const base = 'relative w-full h-56 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#141414] overflow-hidden flex items-center justify-center'

  if (kind === 'panel') {
    return (
      <div className={base}>
        <div className="w-2/3 h-full bg-[#F8F8F8] dark:bg-[#1A1A1A]" />
        <motion.div
          className="absolute right-0 top-0 h-full w-1/2 bg-white dark:bg-[#141414] border-l border-[#E5E7EB] dark:border-[#2A2A2A] p-4"
          initial={{ x: '100%' }}
          whileInView={{ x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="h-2 w-2/3 rounded bg-[#E5E7EB] dark:bg-[#2A2A2A] mb-3" />
          <div className="h-2 w-1/2 rounded bg-[#E5002B]/60 mb-2" />
          <div className="h-2 w-1/3 rounded bg-[#E5E7EB] dark:bg-[#2A2A2A]" />
        </motion.div>
      </div>
    )
  }

  if (kind === 'kanban') {
    return (
      <div className={base}>
        <div className="flex gap-4 w-4/5">
          {[0, 1].map((col) => (
            <div key={col} className="flex-1 h-32 rounded-lg border-2 border-dashed border-[#E5E7EB] dark:border-[#2A2A2A]" />
          ))}
        </div>
        <motion.div
          className="absolute w-24 h-14 rounded-lg bg-white dark:bg-[#1A1A1A] border border-[#E5002B] shadow-lg"
          animate={{ x: [-70, 70, -70], rotate: [0, 3, 0], y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    )
  }

  if (kind === 'comments') {
    return (
      <div className={`${base} flex-col items-start p-5 gap-3`}>
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-[#E5002B] shrink-0" />
          <div className="h-2 w-32 rounded bg-[#E5E7EB] dark:bg-[#2A2A2A]" />
        </div>
        <motion.div
          className="h-2 rounded bg-[#E5E7EB] dark:bg-[#2A2A2A]"
          initial={{ width: 0 }}
          whileInView={{ width: '70%' }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay: 0.3 }}
        />
        <motion.span
          className="w-[2px] h-4 bg-[#E5002B]"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      </div>
    )
  }

  if (kind === 'points') {
    return (
      <div className={`${base} gap-3`}>
        {[1, 2, 3, 5, 8].map((p, i) => (
          <motion.div key={p}
            className="w-10 h-10 rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] flex items-center justify-center text-xs font-semibold"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          >
            {p}
          </motion.div>
        ))}
      </div>
    )
  }

  if (kind === 'palette') {
    return (
      <div className={base}>
        <motion.div
          className="w-3/4 rounded-lg border border-[#E5002B] bg-[#F8F8F8] dark:bg-[#1A1A1A] px-3 py-2 flex items-center gap-2"
          animate={{ boxShadow: ['0 0 0 rgba(229,0,43,0)', '0 0 0 4px rgba(229,0,43,0.12)', '0 0 0 rgba(229,0,43,0)'] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-[#9CA3AF] text-xs">⌘K</span>
          <div className="h-2 w-24 rounded bg-[#E5E7EB] dark:bg-[#2A2A2A]" />
        </motion.div>
      </div>
    )
  }

  if (kind === 'theme') {
    return (
      <div className={base}>
        <motion.div
          className="w-16 h-16 rounded-full"
          animate={{ background: ['#F8F8F8', '#0A0A0A', '#F8F8F8'] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      </div>
    )
  }

  if (kind === 'team') {
    const roles = ['Owner', 'Manager', 'Contributor', 'Reviewer']
    return (
      <div className={`${base} gap-3`}>
        {roles.map((r, i) => (
          <motion.div key={r}
            className="flex flex-col items-center gap-1.5"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3 }}
          >
            <span className="w-8 h-8 rounded-full bg-[#E5002B]/70" />
            <span className="text-[10px] text-[#9CA3AF]">{r}</span>
          </motion.div>
        ))}
      </div>
    )
  }

  if (kind === 'toast') {
    return (
      <div className={`${base} items-start justify-end p-5`}>
        <motion.div
          className="rounded-lg border-l-[3px] border-[#E5002B] bg-white dark:bg-[#1A1A1A] shadow-md px-3 py-2.5 flex items-center gap-2"
          initial={{ x: 120, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <span className="w-4 h-4 rounded-full bg-[#22C55E] shrink-0" />
          <div className="h-2 w-24 rounded bg-[#E5E7EB] dark:bg-[#2A2A2A]" />
        </motion.div>
      </div>
    )
  }

  return null
}
