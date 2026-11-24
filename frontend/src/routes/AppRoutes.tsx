import { Route, Routes } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import ElementListPage from '../pages/ElementListPage'
import { ElementEditorPage } from '../pages/ElementEditorPage'
import { ElementDetailPage } from '../pages/ElementDetailPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { SignInPage } from '../pages/SignInPage'
import { AcceptInvitationPage } from '../pages/AcceptInvitationPage'
import { AccountsPage } from '../pages/AccountsPage'
import { ChangePasswordPage } from '../pages/ChangePasswordPage'
import { ResetPasswordPage } from '../pages/ResetPasswordPage'
import { LegalNoticePage } from '../pages/LegalNoticePage'
import { PrivacyPage } from '../pages/PrivacyPage'
import { AdminOnly } from '../features/auth/AdminOnly'
import { AuthenticationGate } from '../features/auth/AuthenticationGate'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="sign-in" element={<SignInPage />} />
        <Route path="accept-invitation" element={<AcceptInvitationPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="legal-notice" element={<LegalNoticePage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route element={<AuthenticationGate />}>
          <Route index element={<ElementListPage />} />
          <Route
            path="elements/new"
            element={
              <AdminOnly>
                <ElementEditorPage mode="create" />
              </AdminOnly>
            }
          />
          <Route path="elements/:id" element={<ElementDetailPage />} />
          <Route path="admin/accounts" element={<AccountsPage />} />
          <Route path="account/password" element={<ChangePasswordPage />} />
          <Route
            path="elements/:id/edit"
            element={
              <AdminOnly>
                <ElementEditorPage mode="edit" />
              </AdminOnly>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
