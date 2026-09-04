/**
 * src/hooks/useMatch.ts — Person 3 (Match + Results + Standings)
 *
 * ชั้นเดียวที่ feature component เรียก — ไม่มี component ไหน import api/match.ts ตรงๆ
 * พอ backend มาถึง แก้แค่ใน api/match.ts ไฟล์เดียว hook กับ component ไม่ต้องแตะ
 *
 * ── query key namespace ───────────────────────────────────────────────────
 * ขึ้นต้นด้วย 'match' / 'matches' / 'standings' เท่านั้น
 * Person 1 ใช้ 'me' / 'faculties' / 'sportTypes' · Person 2 ควรใช้ 'tournament*'
 * · Person 4 ใช้ 'admin*' — ตกลงกันไว้ในแผนงาน เพื่อไม่ให้ invalidate ข้ามโดเมนกัน
 *
 * ── กฎ invalidate ที่พลาดไม่ได้ ────────────────────────────────────────────
 * schema.sql กำหนดว่า พอผลถูก dispute → matches.match_status ต้องเป็น 'disputed'
 * ในทรานแซกชันเดียวกัน แปลว่า mutation ที่แตะผล ต้อง invalidate ทั้ง result และ match
 * ไม่งั้น UI จะค้างโชว์สถานะแมตช์เก่า — ทำเป็น helper `touchMatch` ไว้ข้างล่าง
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { retryPolicy } from "../api/client";
import type { QueryClient } from "@tanstack/react-query";
import * as matchApi from "../api/match";
import type {
  UpdateMatchRequest,
  SubmitResultRequest,
  VerifyResultRequest,
  DisputeResultRequest,
  ResolveDisputeRequest,
  CheckinRequest,
  VerifyCheckinRequest,
  SaveMatchStatsRequest,
} from "../types/match.dto";
import type { MatchRef } from "../mocks/storeBridge";

// ══════════════ query keys ══════════════

export const matchKeys = {
  all: ["match"] as const,
  detail: (id: MatchRef) => ["match", id] as const,
  result: (id: MatchRef) => ["match", id, "result"] as const,
  checkins: (id: MatchRef) => ["match", id, "checkins"] as const,
  stats: (id: MatchRef) => ["match", id, "stats"] as const,
  byTournament: (tid: MatchRef) => ["matches", "tournament", tid] as const,
  mine: ["matches", "mine"] as const,
  standings: (tid: MatchRef) => ["standings", tid] as const,
  statDefs: (sportTypeId: number) => ["match", "statDefinitions", sportTypeId] as const,
};

/**
 * ผลกับแมตช์เปลี่ยนพร้อมกันเสมอ — และ standings ก็ขยับตามผลที่ยืนยันแล้ว
 * เรียกตัวนี้ใน onSuccess ของทุก mutation ที่แตะผล จะได้ไม่ลืมสัก key
 */
function touchMatch(qc: QueryClient, matchId: MatchRef, tournamentId?: MatchRef) {
  qc.invalidateQueries({ queryKey: matchKeys.detail(matchId) });
  qc.invalidateQueries({ queryKey: matchKeys.result(matchId) });
  /* สถิติเปลี่ยนไปพร้อมผลเสมอ เพราะ ResultForm ส่งสองคำขอติดกัน */
  qc.invalidateQueries({ queryKey: matchKeys.stats(matchId) });
  qc.invalidateQueries({ queryKey: matchKeys.mine });

  /**
   * ล้างทั้ง namespace ไม่ใช่เฉพาะ key ของ id ที่ส่งมา
   *
   * แอปมี id สองระบบพร้อมกัน: หน้าที่มาจาก DTO ถือ id ตัวเลข (`553102`) ส่วนหน้าที่
   * ยังมาจาก prototype ถือ id string (`'t-vb'`) — LeaderboardTab กับ ScheduleTab
   * รับ `t.id` ซึ่งเป็น string ตรงๆ แปลว่า `["standings","t-vb"]` กับ
   * `["standings",553102]` เป็นคนละ cache key ทั้งที่หมายถึงทัวร์นาเมนต์เดียวกัน
   * invalidate ด้วย id เดียวจึงพลาดอีกฝั่งเสมอ — สกอร์เปลี่ยนแล้วตารางคะแนนค้าง
   *
   * ล้างทั้ง namespace แพงกว่าเล็กน้อย (refetch เกินบ้าง) แต่ถูกเสมอ
   * เมื่อไหร่ที่เลิกใช้ store แล้วเหลือ id ระบบเดียว ค่อยกลับไปเจาะจง key ได้
   */
  /* หน้าแมตช์เองก็โดนด้วย — MatchPage ส่ง id ดิบจาก URL ('m-130') ให้ useMatch
     ส่วน mutation ถือ id ตัวเลขจาก DTO จึงเป็นคนละ key เหมือนกัน */
  qc.invalidateQueries({ queryKey: matchKeys.all });
  qc.invalidateQueries({ queryKey: ["matches"] });
  qc.invalidateQueries({ queryKey: ["standings"] });
  /* ผลที่ยืนยันแล้วเปลี่ยนสายและแชมป์ ซึ่งอยู่ในโดเมนของสไลซ์ 2 */
  qc.invalidateQueries({ queryKey: ["tournament"] });
  qc.invalidateQueries({ queryKey: ["tournaments"] });
  void tournamentId;
}

// ══════════════ queries ══════════════

export function useMatch(matchId: MatchRef | undefined) {
  return useQuery({
    queryKey: matchKeys.detail(matchId as MatchRef),
    queryFn: () => matchApi.getMatch(matchId as MatchRef),
    enabled: matchId !== undefined,
    retry: retryPolicy,
  });
}

export function useTournamentMatches(tournamentId: MatchRef | undefined) {
  return useQuery({
    queryKey: matchKeys.byTournament(tournamentId as MatchRef),
    queryFn: () => matchApi.getTournamentMatches(tournamentId as MatchRef),
    enabled: tournamentId !== undefined,
    retry: retryPolicy,
  });
}

/** หน้า /matches — แมตช์ที่ฉันต้องทำอะไรสักอย่าง */
export function useMyMatches() {
  return useQuery({ queryKey: matchKeys.mine, queryFn: matchApi.getMyMatches, retry: retryPolicy });
}

/**
 * ยังไม่มีผล = 404 ไม่ใช่ error ที่ต้อง retry — retry: false กัน request รัวเปล่าๆ
 * ตัวเรียกเช็ค `isError` แล้วโชว์ ResultForm ได้เลย
 */
export function useResult(matchId: MatchRef | undefined) {
  return useQuery({
    queryKey: matchKeys.result(matchId as MatchRef),
    queryFn: () => matchApi.getResult(matchId as MatchRef),
    enabled: matchId !== undefined,
    retry: false,
  });
}

export function useCheckins(matchId: MatchRef | undefined) {
  return useQuery({
    queryKey: matchKeys.checkins(matchId as MatchRef),
    queryFn: () => matchApi.getCheckins(matchId as MatchRef),
    enabled: matchId !== undefined,
    retry: retryPolicy,
  });
}

export function useMatchStats(matchId: MatchRef | undefined) {
  return useQuery({
    queryKey: matchKeys.stats(matchId as MatchRef),
    queryFn: () => matchApi.getMatchStats(matchId as MatchRef),
    enabled: matchId !== undefined,
    retry: retryPolicy,
  });
}

export function useStandings(tournamentId: MatchRef | undefined) {
  return useQuery({
    queryKey: matchKeys.standings(tournamentId as MatchRef),
    queryFn: () => matchApi.getStandings(tournamentId as MatchRef),
    enabled: tournamentId !== undefined,
    retry: retryPolicy,
  });
}

/** กติกาสถิติของกีฬาแทบไม่เปลี่ยน — ไม่ต้อง refetch ระหว่าง session */
export function useStatDefinitions(sportTypeId: number | undefined) {
  return useQuery({
    queryKey: matchKeys.statDefs(sportTypeId as number),
    queryFn: () => matchApi.getStatDefinitions(sportTypeId as number),
    enabled: sportTypeId !== undefined,
    staleTime: Infinity,
    retry: retryPolicy,
  })
}

// ══════════════ mutations ══════════════

/** FixturePage — จัดเวลา/สนาม/เวลาเปิดเช็คอิน */
export function useUpdateMatch(matchId: MatchRef, tournamentId?: MatchRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMatchRequest) => matchApi.updateMatch(matchId, input),
    onSuccess: () => touchMatch(qc, matchId, tournamentId),
  });
}

/** FixturePage — มอบหมายกรรมการเข้าแมตช์ (เขียนทับทั้งชุด) */
export function useAssignReferees(matchId: MatchRef, tournamentId?: MatchRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (refereeUserIds: number[]) => matchApi.assignReferees(matchId, refereeUserIds),
    onSuccess: () => touchMatch(qc, matchId, tournamentId),
  });
}

/** S01 — ส่งผล กดซ้ำได้ปลอดภัย (idempotent ที่ฝั่ง DB) */
export function useSubmitResult(matchId: MatchRef, tournamentId?: MatchRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitResultRequest) => matchApi.submitResult(matchId, input),
    onSuccess: () => touchMatch(qc, matchId, tournamentId),
  });
}

export function useVerifyResult(matchId: MatchRef, tournamentId?: MatchRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VerifyResultRequest = {}) => matchApi.verifyResult(matchId, input),
    onSuccess: () => touchMatch(qc, matchId, tournamentId),
  });
}

export function useDisputeResult(matchId: MatchRef, tournamentId?: MatchRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DisputeResultRequest) => matchApi.disputeResult(matchId, input),
    onSuccess: () => touchMatch(qc, matchId, tournamentId),
  });
}

export function useResolveDispute(matchId: MatchRef, tournamentId?: MatchRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ResolveDisputeRequest) => matchApi.resolveDispute(matchId, input),
    onSuccess: () => touchMatch(qc, matchId, tournamentId),
  });
}

export function useCheckin(matchId: MatchRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CheckinRequest) => matchApi.checkin(matchId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: matchKeys.checkins(matchId) }),
  });
}

export function useVerifyCheckin(matchId: MatchRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { userId: number; input: VerifyCheckinRequest }) =>
      matchApi.verifyCheckin(matchId, v.userId, v.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: matchKeys.checkins(matchId) }),
  });
}

export function useSaveMatchStats(matchId: MatchRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveMatchStatsRequest) => matchApi.saveMatchStats(matchId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matchKeys.stats(matchId) });
      /* สถิติรายคนไหลไปหน้าโปรไฟล์และตารางดาวซัลโวด้วย */
      qc.invalidateQueries({ queryKey: ["standings"] });
      qc.invalidateQueries({ queryKey: ["team", "player"] });
    },
  });
}

export function useSetLivestream(matchId: MatchRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url: string | null) => matchApi.setLivestream(matchId, url),
    onSuccess: () => qc.invalidateQueries({ queryKey: matchKeys.detail(matchId) }),
  });
}
