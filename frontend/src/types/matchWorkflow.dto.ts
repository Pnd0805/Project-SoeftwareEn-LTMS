export interface ResultChallengeInput {
  reason: string;
  claimedWinnerTeamId?: number;
  claimedScoreData?: Record<string, number>;
  evidenceKeys?: string[];
}
export interface MatchDispute {
  matchId: number; status: string; reason: string; raisedBy: { id: number; fullName: string } | null;
  raisedAt: string; claimedWinnerTeamId: number | null; claimedScoreData: Record<string, number> | null;
  evidence: string[]; resolution: string | null; resolvedAt: string | null;
}
export interface ResultComplaint {
  complaintId: number; matchId: number; tournamentId: number; status: 'open' | 'upheld' | 'no_merit';
  stage: 'organizer' | 'admin' | 'decided'; escalatesAt: string;
  filedBy: { id: number; fullName: string }; filedAt: string; reason: string;
  claimedWinnerTeamId: number | null; claimedScoreData: Record<string, number> | null; evidence: string[];
  organizerStatement: { statement: string; by: { id: number; fullName: string }; at: string | null; late: boolean } | null;
  decision: { outcome: string; remedy: string; note: string; by: { id: number; fullName: string }; at: string | null } | null;
  filerFlagged: boolean; canAmendResult: boolean; amendBlockedBy: string | null;
}
export interface ComplaintDecisionInput {
  outcome: 'upheld' | 'no_merit'; remedy: 'record_only' | 'amend_result'; note: string;
  winnerTeamId?: number; scoreData?: Record<string, number>;
}
export interface OrganizerResultInput {
  outcome: 'result' | 'double_forfeit'; reason: string; winnerTeamId?: number; scoreData?: Record<string, number>;
}
