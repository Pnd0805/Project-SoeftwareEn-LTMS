import type { UserRow, TournamentRow, MatchRow } from './db.js';
declare global{
    namespace Express{
        interface Request{
            user? : UserRow;
            tournament? : TournamentRow;
            match? : MatchRow;
        }
    }
}

export {};