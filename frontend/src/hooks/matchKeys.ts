import type { MatchRef } from "../mocks/storeBridge";

/** mutation key ของการเปิดเช็คอิน — ให้ปุ่มสองจุดในหน้าแมตช์รู้ว่าอีกปุ่มกำลังยิงอยู่ */
export const openCheckinKey = (matchId: MatchRef) => ["match", String(matchId), "open-checkin"] as const;
