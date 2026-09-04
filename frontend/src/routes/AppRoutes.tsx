import { Route, Routes } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import ElementListPage from '../pages/ElementListPage'
import { ElementPage } from '../pages/ElementPage'
import { NotFoundPage } from '../pages/NotFoundPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<ElementListPage />} />
        <Route path="elements/new" element={<ElementPage mode="create" />} />
        <Route path="elements/:id" element={<ElementPage mode="detail" />} />
        <Route path="elements/:id/edit" element={<ElementPage mode="edit" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
