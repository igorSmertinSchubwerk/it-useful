import type { ReactNode } from 'react'
import { useI18n } from '../../i18n/context'
import { useCanEdit } from './context'

export function AdminOnly({ children }: { children: ReactNode }) {
  const canEdit = useCanEdit()
  const { t } = useI18n()
  if (canEdit) return children
  return (
    <p role="alert" className="text-red-800">
      {t.adminsOnlyEditing}
    </p>
  )
}
