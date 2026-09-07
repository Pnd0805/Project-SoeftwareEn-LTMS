import type { TeamRow, UserRow } from './db.js';

declare global{
    namespace Express{
        interface Request{
            user? : UserRow;
            team? : TeamRow;
        }
    }
}