import pool from '../config/db.js';
import type { DepartmentRow , FacultyRow } from '../types/db.js';
import type { RowDataPacket } from 'mysql2';
import { AppError } from '../utils/AppError.js';

export async function findDepartmentInFaculty(facId : number , depId : number): Promise<DepartmentRow | null>{
    const [ dep ] = await pool.query<(DepartmentRow & RowDataPacket)[]>(`SELECT * FROM departments WHERE faculty_id = ? AND department_id = ?`,[facId , depId]);
    const department = dep[0];
    return department ?? null;
}