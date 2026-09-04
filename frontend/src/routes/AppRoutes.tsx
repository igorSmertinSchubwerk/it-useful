import { Route, Routes } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import ElementListPage from '../pages/ElementListPage'
import { ElementEditorPage } from '../pages/ElementEditorPage'
import { ElementDetailPage } from '../pages/ElementDetailPage'
import { NotFoundPage } from '../pages/NotFoundPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<ElementListPage />} />
        <Route
          path="elements/new"
          element={<ElementEditorPage mode="create" />}
        />
        <Route path="elements/:id" element={<ElementDetailPage />} />
        <Route
          path="elements/:id/edit"
          element={<ElementEditorPage mode="edit" />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
