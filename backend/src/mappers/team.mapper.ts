import type { TeamRow } from "../types/db.js";

export type TeamRef = {
    id : number,
    name : string,
    sportTypeId : number
}; 

export function toTeamRef(row: Pick<TeamRow , 'team_id' | 'name' | 'sport_type_id'>): TeamRef{
    return {
        id : row.team_id,
        name : row.name,
        sportTypeId : row.sport_type_id
    }
};