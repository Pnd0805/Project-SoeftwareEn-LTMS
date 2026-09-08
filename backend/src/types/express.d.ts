import type { AdminScopeRow , UserRow, TeamRow, TournamentRow, MatchRow } from './db.js';

declare global{
    namespace Express{
        interface Request{
            user? : UserRow;
            team? : TeamRow;
            admin? : AdminScopeRow;
            tournament? : TournamentRow;
            match? : MatchRow;
        }
    }
}

export {};
