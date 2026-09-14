import { Route, Routes } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import ElementListPage from '../pages/ElementListPage'
import { ElementEditorPage } from '../pages/ElementEditorPage'
import { ElementDetailPage } from '../pages/ElementDetailPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { SignInPage } from '../pages/SignInPage'
import { AuthenticationGate } from '../features/auth/AuthenticationGate'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="sign-in" element={<SignInPage />} />
        <Route element={<AuthenticationGate />}>
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
      </Route>
    </Routes>
  )
}
