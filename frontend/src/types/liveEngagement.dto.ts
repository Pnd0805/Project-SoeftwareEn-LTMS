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
  window: { opensAt: string | null; closesAt: string | null; isOpen: boolean };
  candidates: Array<{ userId: number; fullName: string; avatarUrl: string | null; team: { id: number; name: string }; votes: number }>;
  totalVotes: number;
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
}
export interface CommentPage {
  items: TournamentComment[];
  mine: TournamentComment | null;
  canComment: boolean;
  canModerate: boolean;
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export interface PredictionSummary {
  matchId: number;
  isOpen: boolean;
  closedReason: string | null;
  closesAt: string | null;
  total: number;
  teams: Array<{ teamId: number; picks: number; percent: number }>;
  mine: { teamId: number; pointsEarned: number | null; status: 'pending' | 'won' | 'lost' | 'void' } | null;
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
