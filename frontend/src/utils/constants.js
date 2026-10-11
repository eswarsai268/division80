// Shared constants
export const APP_NAME = "Samasya Meedi Parishkaram Maadi";
export const STEPS = ["Record verification", "Voter ID check", "Life status (live / dead)", "T+Live circle", "Verify all details", "Double check"];
export const FLOW = ["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_VERIFICATION", "RESOLVED"];
export const NEXT_STATUS = { SUBMITTED: "UNDER_REVIEW", UNDER_REVIEW: "ASSIGNED", ASSIGNED: "IN_VERIFICATION", IN_VERIFICATION: "RESOLVED" };
export const IMPORT_TEMPLATE = "booth_code,house_code,full_name,relation,voter_id,life_status\nB-1,G-24,Sample Father,FATHER,ABC1234567,ALIVE\nB-1,G-24,Sample Mother,MOTHER,ABC1234568,ALIVE\n";
export const PORTALS = { ADMIN: "Corporator / Admin", BOOTH_MEMBER: "Booth Member", USER: "Citizen" };
