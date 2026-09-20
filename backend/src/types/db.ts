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
    default_mode : 'onsite' | 'online',
    walkover_score : { winner : number, loser : number } | null   // สกอร์ชนะบาย (migration 011)
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
    description : string | null,
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
    external_approval_status : 'not_required' | 'pending' | 'needs_docs' | 'approved' | 'rejected',
    external_verification_docs : string[] | null,   // JSON array ของ S3 key
    approved_by : number | null,
    approved_at : Date | null,
    external_rejection_reason : string | null,
    created_at : Date,
    removed_at : Date | null,
    removed_by : number | null
}

export type MatchRefereeRow = {
    match_referee_id : number,
    match_id : number,
    tournament_referee_id : number,
    assignment_status : 'pending' | 'accepted' | 'declined',
    responded_at : Date | null,
    created_at : Date
}


export type RefereeRequestType = 'org_add_match' | 'ref_transfer' | 'ref_swap' | 'org_swap';
export type RefereeRequestSideStatus = 'not_required' | 'pending' | 'accepted' | 'declined';

export type RefereeChangeRequestRow = {
    request_id : number,
    tournament_id : number,
    request_type : RefereeRequestType,
    requested_by : number,
    referee_a_id : number,
    referee_b_id : number | null,
    match_a_id : number,
    match_b_id : number | null,
    a_status : RefereeRequestSideStatus,
    b_status : RefereeRequestSideStatus,
    request_status : 'open' | 'applied' | 'declined' | 'cancelled',
    created_at : Date,
    resolved_at : Date | null
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
    scheduled_end_time : Date | null,    
    venue : string | null,
    checkin_open_at : Date | null,
    match_status : 'scheduled' | 'checkin_open' | 'in_progress' | 'completed' | 'disputed' | 'result_rejected',
    mode : 'onsite' | 'online',
    livestream_url : string | null,
    room_code : string | null,          // แมตช์ online (migration 016)
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

export type BracketNodeRow = {
    bracket_node_id : number,
    tournament_id : number,
    node_code : string,
    bracket_type : 'winners' | 'losers' | 'grand_final',
    round : number | null,
    match_number : number,
    team_a_id : number | null,
    team_b_id : number | null,
    match_id : number | null,
    created_at : Date,
    updated_at : Date | null,
};

export type MatchCheckinRow = {
    match_checkin_id : number,
    match_id : number,
    user_id : number,
    method : 'qr_onsite' | 'photo_online' | 'manual_by_referee',
    match_checkin_status : 'success' | 'rejected' | 'exception' | 'pending',
    rejection_reason : string | null,
    note : string | null,               // M19 เหตุผลที่กรรมการอนุโลม (migration 015)
    document_type : 'student_id' | 'national_id' | null,
    document_s3_key : string | null,
    verified_by_referee_id : number | null,
    checked_in_at : Date,
    verified_at : Date | null,
};

export type TeamAdminRequestRow = {
    team_admin_request_id : number,
    team_id : number,
    request_type : 'official_status' | 'leader_transfer',
    requested_by : number,
    target_user_id : number | null,
    team_admin_request_status : 'pending' | 'approved' | 'rejected',
    requested_at : Date,
    reviewed_by : number | null,
    reviewed_at : Date | null,
    rejection_reason : string | null,
    supporting_docs : string[] | null;
}

export type AdminScopeRow = {
    admin_scope_id : number,
    user_id : number,
    scope_type : 'faculty' | 'university_wide',
    faculty_id : number | null,
    created_at : Date,
    created_by : number | null
}

export type AnnouncementRow = {
    announcement_id : number,
    tournament_id : number,
    match_id : number | null,
    created_by : number,
    announcement_type : 'general' | 'schedule_change' | 'venue_change' | 'result' | 'livestream',
    title : string,
    content : string,
    created_at : Date,
    updated_at : Date | null,
    updated_by : number | null,
    deleted_at : Date | null,
    deleted_by : number | null
}

export type MatchResultRow = {
    match_result_id : number,
    match_id : number,
    winner_team_id : number | null,
    score_data : Record<string , number> | null,
    submitted_by_user_id : number,
    submitted_role : 'team_leader' | 'referee' | 'organizer',
    match_result_status : 'submitted' | 'verified' | 'disputed' | 'rejected' | 'walkover',
    dispute_reason : string| null,
    dispute_raised_by : number| null,
    dispute_raised_at : Date| null,
    dispute_resolved_by : number| null,
    dispute_resolution : string| null,
    dispute_resolved_at : Date| null,
    verified_by_user_id : number| null,
    verified_at : Date| null, 
    amended_by_user_id : number| null,
    amend_reason : string| null,
    amended_at : Date| null,
    created_at : Date
}

export type PlayerMatchStatRow = {
    player_match_stat_id : number,
    match_id : number,
    user_id : number,
    team_id : number,
    recorded_by_referee_id : number,
    created_at : Date
}

export type PlayerMatchStatValueRow = {
    player_match_stat_value_id : number,
    player_match_stat_id : number,
    sport_stat_definition_id : number,
    value_int : number | null
}

export type TournamentStandingRow = {
    standing_id : number,
    tournament_id : number,
    team_id : number,
    played : number,
    won : number,
    lost : number,
    points : number,
    updated_at : Date
}