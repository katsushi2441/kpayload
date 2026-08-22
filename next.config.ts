import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: { unoptimized: true },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
