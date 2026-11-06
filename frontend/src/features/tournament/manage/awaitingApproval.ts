import type { Tournament } from '../../../shared/types'

/** ยังไม่ผ่าน admin — route ของผู้จัดตอบ 403 ทุกเส้น (requireOrganizer) */
export const awaitingApproval = (t: Tournament) => t.status === 'pending' || t.serverStatus === 'rejected'
