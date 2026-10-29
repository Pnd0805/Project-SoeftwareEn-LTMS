import { ApiError } from '../../api/client'

export const checkinErrorMessage = (error: unknown) => {
  const code = error instanceof ApiError ? error.code : null
  if (code === 'NOT_IN_APPROVED_ROSTER') {
    return 'Your team did not submit you in the approved lineup for this match. Ask the team leader or organizer to check the application roster.'
  }
  if (code === 'CHECKIN_NOT_OPEN') return 'Check-in is not open for this match. Ask the organizer to open it, then retry.'
  if (code === 'CHECKIN_METHOD_MISMATCH') return 'This check-in method does not match the match mode. On-site matches use QR; online matches use an ID photo.'
  if (code === 'CHECKIN_QR_MISMATCH') return 'That QR is invalid, expired, or belongs to another match. Scan the current code shown by this match referee.'
  if (code === 'ALREADY_CHECKED_IN') return 'You are already checked in. Refreshing your status will show the saved result.'
  /* OD-19 (21 ก.ย.) แยกสองรหัสนี้ออกจากกัน เพราะทางออกคนละทาง: ถูกปฏิเสธไปแล้ว = เริ่มใหม่ได้
     ส่วนผ่านไปแล้ว = ยืนยันซ้ำไม่ได้ ต้องถอนก่อน */
  if (code === 'ALREADY_REJECTED') return 'This check-in was already rejected. The player can check in again, or a referee can verify them by hand.'
  if (code === 'ALREADY_DECIDED') return 'This check-in already went through. Reject it first if it needs to be undone.'
  if (code === 'MATCH_NOT_CHANGEABLE') return 'This match is past the point where check-ins can be changed.'
  if (code === 'NOT_REFEREE') return 'Only a referee assigned to this match can decide a check-in.'
  if (code === 'UPLOAD_FAILED') return 'The ID photo could not be uploaded. Check your connection and take the photo again.'
  if (code === 'MATCH_NOT_FOUND') return 'This match no longer exists or is not available.'
  return error instanceof Error && error.message
    ? error.message
    : 'The check-in request failed. Retry, and ask the referee to inspect the server log if it happens again.'
}
