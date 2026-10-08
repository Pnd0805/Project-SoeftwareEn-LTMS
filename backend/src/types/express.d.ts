import type { AdminScopeRow , UserRow, TeamRow, TournamentRow, MatchRow, MatchResultRow, AnnouncementRow } from './db.js';

declare global{
    namespace Express{
        interface Request{
            user? : UserRow;
            team? : TeamRow;
            admin? : AdminScopeRow;
            tournament? : TournamentRow;
            match? : MatchRow;
            matchResult? : MatchResultRow;
            announcement? : AnnouncementRow;

            submitrole? : 'team_leader' | 'referee';
        }
    }
}

export {};
