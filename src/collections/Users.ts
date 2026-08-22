import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: '管理者', plural: '管理者' },
  admin: { useAsTitle: 'email' },
  auth: true,
  fields: [],
}
