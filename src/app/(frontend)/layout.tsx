import type { Metadata } from 'next'
import React from 'react'

export const metadata: Metadata = {
  title: 'Kurage Payload CMS',
  description: 'Kurage OSSカタログの管理画面',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="ja"><body style={{ margin: 0 }}>{children}</body></html>
}
