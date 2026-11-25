import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import { DashboardPage } from '../pages/DashboardPage'
import { SettingsPage } from '../pages/SettingsPage'
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
        <Route
          path="admin/accounts"
          element={<Navigate to="/settings/accounts" replace />}
        />
        <Route
          path="account/password"
          element={<Navigate to="/settings/password" replace />}
        />
        <Route element={<AuthenticationGate />}>
          <Route index element={<DashboardPage />} />
          <Route path="elements" element={<ElementListPage />} />
          <Route
            path="elements/new"
            element={
              <AdminOnly>
                <ElementEditorPage mode="create" />
              </AdminOnly>
            }
          />
          <Route path="elements/:id" element={<ElementDetailPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/accounts" element={<AccountsPage />} />
          <Route path="settings/password" element={<ChangePasswordPage />} />
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
