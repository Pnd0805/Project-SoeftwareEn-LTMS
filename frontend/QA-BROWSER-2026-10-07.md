# LTMS browser QA — 7 Oct 2026

Tested through the connected Chrome extension against real-mode frontend at
`http://127.0.0.1:5193`, backend at port 8000 and MinIO at port 9000.
Verified/fetched `BE_KN@8d161a6d25b1ebc501e1412bde37b911cfdea4de` again.
This is developer browser QA for the flows below; it does not close all FE-01–FE-43.

## Observed passes

| Flow | Browser evidence |
|---|---|
| Guest homepage | 14 listed tournaments; Open for entry filter shows 5 of 14 |
| Student login/reload | Mana fixture identity and Student menu remain correct after full reload |
| Profile settings | Contact and hidden-stat preference saved and survived reload; restored empty contact and visible statistics |
| Notification preferences | Community change saved; Critical stayed checked/disabled; Community restored |
| Logout / account switch | Login screen after logout; Faculty, University and organizer identities/menus changed correctly |
| Faculty audit gate | Role explanation; no audit cards or pagination |
| Faculty stalled gate | Root/University restriction displayed |
| Faculty report queue | Both rejected QA reports loaded with reviewer/reason |
| MinIO image preview | Both generated PNG evidence images loaded, complete=true and natural dimensions 1×1 |
| University audit | Page 1: 20 records; Next: page 2 with 18 distinct earlier records and Next disabled |
| Audit search | Search 9101 on page 2 shows three matching actor records; current-page limitation displayed |
| University stalled overview | Real counts/IDs displayed, with read-only explanation |
| Audit cache after role switch | University -> Faculty shows restriction and no cached audit records |
| Organizer private tournament | Organizer can read QA tournament 29, private status and registration dates |
| Announcement validation | Whitespace-only title/body rejected with field messages; all five type options present |
| Announcement create/edit | Created trimmed schedule-change text, edited body/type to venue change; card refreshed after each save |
| Announcement deletion cancel | Confirmation opens; Cancel preserves the card; destructive confirmation was not submitted through UI |
| Guest private access after logout | Tournament 29: does not exist; match 15: No such match; organizer content absent |
| Guest /me | Redirects to login form |
| Profile checkbox correction | Checkbox widths now 13px within flex rows; visible image confirms labels and checkboxes align |
| Announcement copy correction | Composer now describes access to the tournament page rather than promising a public page for a private tournament |

Selected DOM snapshots are in [QA-browser-2026-10-07](QA-browser-2026-10-07/).
Presigned URL queries were redacted; credentials and access tokens were not saved.

## FE fixes from this browser pass

- Scope checkbox sizing/layout to Profile settings and Notification preferences,
  avoiding the global input width=100% rule wrapping checkboxes onto their own rows.
- Correct announcement composer visibility wording for private tournaments.

Regression: **6 files / 27 tests passed** for profile, announcements, admin scopes
and sessions. Lint and TypeScript/production build passed. The existing bundle
warning remains (main 924.59 kB).

## Cleanup and limits

- Browser-created announcement 6 on QA tournament 29 was removed through the API
  after checking its exact QA title/body; 204 and absence verified. See [cleanup](QA-browser-2026-10-07/cleanup.json).
- Profile/contact/stat visibility and Community preference restored; last browser
  account logged out. Temporary viewport override reset.
- Stopped only the isolated frontend server owned by this run; port 5193 no
  longer has a listener. Backend and Docker services were left running.
- Native screenshot observation worked, but saving the screenshot through the
  browser capture API repeatedly timed out. No exportable screenshot is claimed.
- Requested viewport 390×844 rendered with DOM width about 506px; capture also
  repeated portions of the page. This is insufficient for a 390px mobile sign-off.
- Browser file selection/PUT upload, presigned-link expiry/missing file, light theme,
  network waterfall, OTP/SMTP/password reset, stale-token expiry, joins/conflicts,
  dispute decisions, manual draw, online mode and real-device scan remain open.
- API integration already covered additional workflows in [QA-LIVE-2026-10-07](QA-LIVE-2026-10-07.md).

See [backend handoff](TO-BACKEND-2026-10-07-frontend-qa-response.md) for the three
live API findings and undelivered contracts. No backend files or migrations changed.
