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

export type TournamentRow = {
    tournament_id : number,
    name : string,
    sport_type_id : number,
    bracket_format : 'single_elimination' | 'double_elimination' | 'round_robin' | null,
    scope_type : 'department' | 'faculty' | 'university',
    organizing_faculty_id : number | null,
    organizing_department_id : number | null,
    requested_by_user_id : number,
    organizer_external_approval_status : 'not_required' | 'pending' | 'approved' | 'rejected',
    organizer_external_reviewed_by : number | null,
    organizer_external_reviewed_at : Date | null,
    organizer_external_rejection_reason : string | null,
    organizer_external_verification_docs : unknown,
    tournament_status : 'pending_approval' | 'rejected' | 'private' | 'public' | 'completed' | 'auto_deleted',
    registration_open : number,
    registration_start : Date | null,
    registration_end : Date | null,
    event_start_date : string,
    event_end_date : string | null,
    max_teams : number,
    min_teams : number,
    venue : string | null,
    dispute_window_hours : number,
    gender_requirement : 'any' | 'male' | 'female',
    min_age : number | null,
    max_age : number | null,
    rejection_reason : string | null,
    approved_by : number | null,
    approved_at : Date | null,
    created_at : Date,
    updated_at : Date | null,
    updated_by : number | null,
    deleted_at : Date | null,
    deleted_by : number | null,
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

export type TournamentRefereeRow = {
    tournament_referee_id : number,
    tournament_id : number,
    user_id : number,
    invited_by : number,
    invitation_status : 'pending' | 'accepted' | 'rejected',
    is_external : number,                   
    external_approval_status : 'not_required' | 'pending' | 'approved' | 'rejected',
    approved_by : number | null,
    approved_at : Date | null,
    created_at : Date,
    removed_at : Date | null,
    removed_by : number | null
}

export type MatchRefereeRow = {
    match_referee_id : number,
    match_id : number,
    tournament_referee_id : number,
    created_at : Date
}


export type MatchRow = {
    match_id : number,
    tournament_id : number,
    bracket_node_id : number | null,
    next_match_id : number | null,
    loser_next_match_id : number | null,
    round_number : number | null,
    team_a_id : number | null,
    team_b_id : number | null,
    scheduled_time : Date | null,
    venue : string | null,
    checkin_open_at : Date | null,
    match_status : 'scheduled' | 'checkin_open' | 'in_progress' | 'completed' | 'disputed',
    mode : 'onsite' | 'online',
    created_at : Date,
    updated_at : Date | null
}


export type TeamMemberRow = {
    team_member_id : number,
    team_id : number,
    user_id : number,
    position : 'starter' | 'substitute';
    joined_at : Date
};


export type TeamInvitationRow = {
    team_invitation_id : number,
    team_id : number,
    invited_user_id : number,
    invited_by_user_id : number,
    team_invitation_status : 'pending' | 'accepted' | 'rejected' | 'expired', 
    created_at : Date,
    expires_at : Date,
    responded_at : Date | null
};
