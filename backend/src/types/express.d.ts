import type { AdminScopeRow, TeamRow, UserRow } from './db.js';

declare global{
    namespace Express{
        interface Request{
            user? : UserRow;
            team? : TeamRow;
            admin? : AdminScopeRow;
        }
    }
}