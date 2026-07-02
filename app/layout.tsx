import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PM Platform',
  description: 'Projects and tasks, kept simple',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
