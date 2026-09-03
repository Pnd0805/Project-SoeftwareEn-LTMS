export type UserRow = {
    user_id : number,
    full_name : string,
    email : string,
    password_hash : string,
    gender : 'male' | 'female' | 'other',
    birth_date : string,
    user_type : 'student' | 'staff' | 'external',
    faculty_id : number | null,
    department_id : number | null,
    year : number | null,
    profile_image_key : string | null,
    contact_info : string | null,
    address : string | null,
    is_suspended : number,
    suspended_reason : string | null,
    total_points : number,
    notification_prefs :  Record<string, boolean> | null,
    profile_edit_log : unknown,
    created_at : Date,
    updated_at : Date | null,
}

export type FacultyRow = {   //format ที่จะรับมาจาก mysql2
    faculty_id : number,
    name : string
}

export type DepartmentRow = {
    department_id : number,
    faculty_id : number,
    name : string
}

export type SportTypeRow = {
    sport_type_id : number,
    name : string,
    min_members : number,
    max_members : number,
    default_mode : 'onsite' | 'online'
}

export type SportStatDefinitionRow = {
    sport_stat_definition_id : number,
    sport_type_id : number,
    stat_key : string,
    stat_label_th : string,
    data_type : 'integer' | 'decimal' | 'boolean',
    display_order : number
}

export type TeamRow = {
    team_id : number,
    name : string,
    sport_type_id : number,
    leader_id : number,
    readiness_status : 'Forming' | 'Ready',
    official_status : 'Unofficial' | 'Official',
    created_at : Date,
    updated_at : Date | null,
    last_competed_at : Date | null,
    deleted_at : Date | null,
    deleted_reason : 'no_registration' | 'leader_deleted' | 'inactive_6_months' | null
}

export type PlayerProfileStatRow = {
    player_profile_stat_id : number,
    user_id : number,
    sport_type_id : number,
    matches_played : number,
    wins : number,
    losses : number,
    championships : number,
    updated_at : Date
}
