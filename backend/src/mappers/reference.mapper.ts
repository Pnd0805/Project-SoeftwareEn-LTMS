import type { FacultyRow , DepartmentRow , SportTypeRow , SportStatDefinitionRow } from "../types/db.js"

export type FacultyDto = {
    id : number,
    name : string
};

export type DepartmentDto = {
    id : number,
    facultyId : number,
    name : string
}; 

export type SportTypeDto = {
    id : number,
    name : string,
    minMembers : number,
    maxMembers : number,
    defaultMode : 'onsite' | 'online'
}; 

export type SportStatDefinitionDto = {
    statDefinitionId : number,
    statKey : string,
    statLabelTh : string,
    dataType : 'integer' | 'decimal' | 'boolean',
    displayOrder : number
};

export function toFacultyDto(row: FacultyRow):FacultyDto {
    return {
        id : row.faculty_id,
        name : row.name
    }
}

export function toDepartmentDto(row : DepartmentRow):DepartmentDto {
    return {
        id : row.department_id,
        facultyId : row.faculty_id,
        name : row.name
    }
}

export function toSportTypeDto(row: SportTypeRow): SportTypeDto{
    return {
        id : row.sport_type_id,
        name : row.name,
        minMembers : row.min_members,
        maxMembers : row.max_members,
        defaultMode : row.default_mode
    }
}

export function toSportStatDefinitionDto(row : SportStatDefinitionRow):SportStatDefinitionDto{
    return {
        statDefinitionId : row.sport_stat_definition_id,
        statKey : row.stat_key,
        statLabelTh : row.stat_label_th,
        dataType : row.data_type,
        displayOrder : row.display_order
    };
}