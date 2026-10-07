export interface ReviewSummary {
  summary: { average: number | null; count: number; distribution: Record<string, number> };
  status: 'not_started' | 'open' | 'closed';
  opensAt: string | null;
  closesAt: string | null;
  mine: { id: number; rating: number; content: string | null; createdAt: string } | null;
  canSubmit: boolean;
  items: Array<{ id: number; rating: number; content: string | null; isReported: boolean; createdAt: string; author: { id: number; fullName: string } | null }> | null;
}

export interface MvpSummary {
  matchId: number;
  window: { opensAt: string | null; closesAt: string | null; isOpen: boolean };
  candidates: Array<{ userId: number; fullName: string; avatarUrl: string | null; teamId: number; stats: Array<{ statKey: string; statLabelTh: string; value: number }>; votes?: number }>;
  totalVotes?: number;
  winners: number[];
  mine: { votedForUserId: number } | null;
  canVote: boolean;
}

export interface TournamentComment {
  id: number;
  tournamentId: number;
  author: { id: number; fullName: string; avatarUrl: string | null };
  content: string;
  createdAt: string;
  isMine: boolean;
  isReported?: boolean;
  reportCleared?: boolean;
}
export interface CommentPage {
  items: TournamentComment[];
  mine: TournamentComment | null;
  canComment: boolean;
  canModerate: boolean;
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export interface RemovedFeedbackItem {
  id: number;
  tournamentId: number;
  tournamentName: string;
  feedbackType: 'comment' | 'organizer_feedback' | 'mvp_vote';
  content: string | null;
  rating: number | null;
  author: { id: number; fullName: string; avatarUrl: string | null };
  removedAt: string;
  removedBy: { id: number; fullName: string } | null;
  removalReason: string | null;
  removedByRole: 'organizer' | 'admin' | null;
  canRestore: boolean;
}
export interface RemovedFeedbackPage {
  items: RemovedFeedbackItem[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export interface PredictionSummary {
  matchId: number;
  isOpen: boolean;
  closedReason: string | null;
  closesAt: string | null;
  total: number;
  teams: Array<{ teamId: number; picks: number; percent: number }>;
  /** OD-56 — ทายเป็นสกอร์ (teamId = ผู้ชนะที่ระบบอนุมานจากสกอร์) · pointsEarned เป็น 10/7/4/0 ไม่ใช่ 10/0 */
  mine: { teamId: number; scoreData?: Record<string, number> | null; pointsEarned: number | null; status: 'pending' | 'won' | 'lost' | 'void' } | null;
  canPredict: boolean;
}
export interface PickemHistory {
  totalPoints: number;
  correct: number;
  settled: number;
  items: Array<{ matchId: number; tournament: { id: number; name: string }; teamA: { id: number; name: string } | null; teamB: { id: number; name: string } | null; predicted: { id: number; name: string }; scheduledTime: string | null; pointsEarned: number | null; status: string; createdAt: string }>;
}
export interface PickemLeaderboard {
  items: Array<{ rank: number; user: { id: number; fullName: string; avatarUrl: string | null }; points: number; correct: number; settled: number }>;
}
