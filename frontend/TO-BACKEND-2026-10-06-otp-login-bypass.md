# OTP can be bypassed at login — 2026-10-06

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
  only after validating credentials. FE will add the return-to-OTP action after
  the error contract is delivered.
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
