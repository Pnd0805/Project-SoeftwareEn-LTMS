import type { UserRow, TeamRow, TournamentRow, MatchRow } from './db.js';

declare global{
    namespace Express{
        interface Request{
            user? : UserRow;
            team? : TeamRow;
            tournament? : TournamentRow;
            match? : MatchRow;
        }
    }
}

export {};
