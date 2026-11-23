# Public accounts spec

**Status:** draft for approval. For the server variant, this replaces the
private single-owner target in [`SERVER_SECURITY_PLAN.md`](SERVER_SECURITY_PLAN.md).
Local development mode stays unchanged.

## Spine

- **Problem:** The server variant admits exactly one GitHub account and is
  reachable only through Tailscale. IT Useful must instead be reachable on the
  internet at `https://it-useful.schubwerk.tech` and be used by several invited
  people with different permissions.
- **Goal:** People get in only by an admin's invitation and an admin's
  confirmation. Users read, and admins change content and manage accounts.
  Nothing is visible without signing in.
- **Non-goals:** public sign-up, social login, private per-user definitions,
  content edit history, and multi-factor authentication in this version.

## Roles

| Role | Read definitions and images | Create, edit, delete content | Invite, confirm, and manage accounts |
| --- | --- | --- | --- |
| `USER` | yes | no | no |
| `ADMIN` | yes | yes | yes |

## Account lifecycle

The flow follows Bitwarden's organization members: invited, accepted, confirmed.

| State | Reached when | Can sign in | Can read |
| --- | --- | --- | --- |
| `INVITED` | An admin creates an invitation link | no | no |
| `ACCEPTED` | The invitee opens the link and sets a password | yes | no, sees a waiting page |
| `CONFIRMED` | Any admin confirms the account | yes | yes, with the invited role |
| `DISABLED` | An admin disables the account | no | no |

## User stories

- As an admin, I send an invitation link with a role, so only people we choose can apply.
- As an invited person, I set my password through the link and wait for confirmation.
- As an admin, I confirm accepted accounts, so nobody gets in on a forwarded link alone.
- As a user, I browse definitions but cannot change them.
- As an admin, I change roles, disable accounts, and create reset links for forgotten passwords.

## Acceptance criteria

### Access

- **AC-1:** WHEN a request without a valid session reaches any page or `/api/**`
  route other than sign-in, invitation acceptance, and password reset, THE SYSTEM
  SHALL answer `401` for API calls and send browser navigation to the sign-in page.
- **AC-2:** WHEN a `USER` calls any create, update, or delete endpoint for
  definitions or images, THE SYSTEM SHALL answer `403` and change nothing.
- **AC-3:** WHEN an `ADMIN` calls those endpoints with a valid CSRF token, THE
  SYSTEM SHALL perform them as it does today.
- **AC-4:** WHEN a `USER` calls an account-management endpoint, THE SYSTEM SHALL
  answer `403`.

### Invitation and confirmation

- **AC-5:** WHEN an admin invites an email address with a role, THE SYSTEM SHALL
  return a single-use link that expires after 7 days and store only a hash of its token.
- **AC-6:** WHEN an invitee opens a valid link and sets a password that meets
  AC-11, THE SYSTEM SHALL create the account in state `ACCEPTED`.
- **AC-7:** WHILE an account is `ACCEPTED`, THE SYSTEM SHALL let it sign in, show
  only a waiting page, and answer `403` with code `confirmation_pending` on every
  other API call.
- **AC-8:** WHEN any admin confirms an `ACCEPTED` account, THE SYSTEM SHALL make
  it `CONFIRMED` with the invited role, effective on its next request.
- **AC-9:** WHEN an invitation link is expired, used, revoked, or unknown, THE
  SYSTEM SHALL refuse it with one generic message.
- **AC-10:** THE SYSTEM SHALL offer no self-registration endpoint.

### Credentials

- **AC-11:** THE SYSTEM SHALL accept passwords of 12 to 128 characters, reject a
  password equal to the email address or found in a bundled list of common
  passwords, and impose no character-class rules.
- **AC-12:** THE SYSTEM SHALL store passwords only as bcrypt hashes.
- **AC-13:** WHEN sign-in fails, THE SYSTEM SHALL show the same message whether
  or not the email address exists.
- **AC-14:** WHEN an account has 5 failed sign-ins within 15 minutes, THE SYSTEM
  SHALL refuse sign-in for that account for 15 minutes. The proxy SHALL also
  rate-limit sign-in requests per client address.
- **AC-15:** WHEN a signed-in user changes their password, THE SYSTEM SHALL
  require the current password and end the user's other sessions.
- **AC-16:** WHEN an admin creates a password-reset link, THE SYSTEM SHALL return
  a single-use link valid for 24 hours, hashed at rest. Using it sets a new
  password and ends every session of that account.

### Account management

- **AC-17:** WHEN an admin changes a role or disables an account, THE SYSTEM
  SHALL apply it on that user's next request, and end the user's sessions when
  the account is disabled.
- **AC-18:** THE SYSTEM SHALL refuse to disable or demote the last confirmed `ADMIN`.
- **AC-19:** WHEN no account exists, an operator command on the host SHALL create
  the first admin's invitation link. That first account is `CONFIRMED` on
  acceptance, because no admin exists to confirm it. No default password exists.
- **AC-20:** THE SYSTEM SHALL log failed sign-ins, lockouts, invitations,
  confirmations, role changes, disabled accounts, and resets with the account id
  and the acting admin's id, and never log a password or token.

### Public hosting

- **AC-21:** `https://it-useful.schubwerk.tech` SHALL serve the application with
  a publicly trusted certificate, redirect HTTP to HTTPS, and keep the existing
  CSP, HSTS, and frame-denial headers.
- **AC-22:** THE SYSTEM SHALL build invitation and reset links only from
  `APP_PUBLIC_BASE_URL`, never from request headers, and the validator SHALL
  accept the public HTTPS origin.
- **AC-23:** The co-hosted pagegenerator site, certificate, and ports SHALL stay
  unchanged. The host gains only one new nginx server block for this domain.

## Decisions taken

- **D1:** Invite, accept, confirm. Any admin can invite and confirm. All content
  writes are admin-only. Roles `USER` and `ADMIN`. Owner decisions of 2026-11-23.
- **D2:** The GitHub owner login and Tailscale are removed from the server
  variant, which keeps one credential model.
- **D3:** This version sends no email. The admin copies invitation and reset
  links and passes them on. Adding SMTP later does not change the data model.
- **D4:** The host's existing nginx and certbot terminate TLS, as they already
  do for pagegenerator.
- **D5:** Spring Security form login with the existing server-side session,
  cookie, and CSRF settings.

## Open questions (they block going public, not development)

- **Q1:** A public company website that stores personal data needs an Impressum
  and a privacy policy. Who provides the text?
- **Q2:** Is D3 acceptable, or will an SMTP account be provided?
- **Q3:** Does the pagegenerator owner agree to the extra nginx site and certificate?

## Delivery phases

Each phase is one pull request that leaves `main` deployable. Nothing becomes
public before phase 5.

| Phase | Content | Fulfills |
| --- | --- | --- |
| 1 | Accounts schema (`V2` migration for accounts, invitations, reset tokens) and password rules | AC-11, AC-12 |
| 2 | Form login replaces the GitHub login, role checks, lockout, security logging | AC-1 to AC-4, AC-13, AC-14, AC-20 |
| 3 | Invitations, acceptance page, waiting page, confirmation, and the first-admin command | AC-5 to AC-10, AC-19 |
| 4 | Account administration page, password change, and reset links | AC-15 to AC-18 |
| 5 | Public origin in the validator, nginx site and certificate, runbook and security docs | AC-21 to AC-23 |

**Go-live gate:** Q1 to Q3 answered, every criterion covered by a passing test or
a recorded manual check, and the assembled security test passing against the
public configuration.
