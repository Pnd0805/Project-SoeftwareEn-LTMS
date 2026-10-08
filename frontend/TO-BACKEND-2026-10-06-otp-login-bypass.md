# OTP can be bypassed at login — 2026-10-06

## Current follow-up — 2026-10-08: still open

Owner reports OTP can still be skipped. Verified ls-remote/fetched current
`BE_KN@240e9e62ca5aa5c429e9e7159414692c2052ae45` and inspected source:

- `backend/src/services/auth.service.ts:188-205`: login validates credentials
  and suspension, then calls `signToken` at line 203. It does not check
  `user.email_verified` before issuing the access token.
- `backend/src/middlewares/requireAuth.ts`, `loadUser`: checks existence,
  token_version and suspension, then returns the user without verification
  enforcement. Both requireAuth and optionalAuth use this loader.
- This is source evidence plus the owner's runtime report, not a new authenticated
  reproduction by FE. No account was created, email sent or database changed.

Latest owner clarification (8 Oct): **waiting for BE to merge real SMTP instead
of the simulated mail service**. Round 6 previously recorded a Google 2FA pause;
that is historical context, not the latest handoff status. FE awaits the delivered
merge and its configuration/contract before live acceptance.

SMTP delivery and login authorization are separate requirements. The pre-merge
source above still issues tokens to unverified accounts. After the merge, verify
both real OTP delivery and enforcement before marking the bypass closed; do not
assume an SMTP-only change adds the missing login/loadUser checks.

**BE action required before production acceptance:** implement the login and
existing-token gates below, deliver their error/status contract, merge/configure
the real SMTP integration, and test the complete verification flow. Do not turn
every legacy/seeded account into a verified account
as a blanket workaround. Development fixtures need an explicit verified policy.

FE already hides Login on the pending-OTP step and offers the return-to-OTP link
when the API returns `EMAIL_NOT_VERIFIED` (`LoginPage.tsx`). No browser-local flag
can enforce the same policy on direct API login or protected requests. No FE-only
block was added as a substitute for the missing server check.

## Historical report and remaining BE acceptance

Verified remote/fetched `BE_KN@29a6aec895438f5986a1e28f7c28e1c5e694cde4`.
User reports registration -> skip OTP -> Login succeeds. Source confirms the
missing enforcement; no new account or API reproduction was created in this FE run.

- [x] FE removes Login navigation from the pending OTP step. After successful
  AV01 verification, the Login button remains available.
- [ ] BE `backend/src/services/auth.service.ts`, `login`: after validating the
  password and suspension, reject `email_verified !== 1` before `signToken`.
- [ ] Proposed contract for BE approval: HTTP 403 `EMAIL_NOT_VERIFIED`, message
  `กรุณายืนยันอีเมลด้วย OTP ก่อนเข้าสู่ระบบ`; no access token or authenticated cookie.
  Keep wrong-email/password responses unchanged; determine verification state
  only after validating credentials. FE now has the return-to-OTP action when
  this code is returned; BE still needs to implement/deliver the enforcement.
- [ ] BE `backend/src/middlewares/requireAuth.ts`, `loadUser`: check verified
  status as well, including any optional-auth path that uses the same loader,
  so tokens previously issued to an unverified account cannot access protected
  data. Public AV01/AV02 verification/resend must stay accessible without login.
- [ ] Check reset-password/other token-issuing paths for the same enforcement.
  Password recovery must not implicitly verify an email unless explicitly agreed.
- [ ] Decide handling of existing seeded/admin accounts: identify intentional
  verified fixtures; do not indiscriminately mark all unverified accounts verified.
- [ ] BE/API regressions: new unverified account + correct password denied with
  no token; wrong password retains INVALID_CREDENTIALS; valid OTP then login
  succeeds; invalid/expired OTP keeps login denied; pre-fix token cannot access
  `/me`/protected writes; verified and suspended-account behavior remains correct.
- [ ] Live acceptance includes typing `/login` directly and calling the login
  API directly. Removing a frontend link is not closure of this issue.

Frontend `LoginResponse` currently includes no verification field. A browser
flag cannot provide authoritative enforcement. Backend working tree is unchanged.
