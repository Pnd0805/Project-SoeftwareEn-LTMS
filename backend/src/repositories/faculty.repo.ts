import pool from '../config/db.js';
import type { FacultyRow , DepartmentRow } from '../types/db.js';
import type { RowDataPacket } from 'mysql2';

export async function findAllFaculties(): Promise<FacultyRow[]>{
    const [ rows ] = await pool.query<(FacultyRow & RowDataPacket)[]>('SELECT * FROM faculties ORDER BY faculty_id');
    return rows;
}

export async function findFacultyById(facId : number): Promise< FacultyRow | null>{
    const [rows] = await pool.query<(FacultyRow & RowDataPacket)[]>("SELECT * FROM  faculties WHERE faculty_id=?",[facId]);
    const faculty = rows[0];
    return faculty ?? null;
}

export async function findDepartmentsByFaculty(facId : number): Promise<DepartmentRow[]>{
    const [rows ] = await pool.query<(DepartmentRow & RowDataPacket)[]>('SELECT * FROM departments WHERE faculty_id=?',[facId]);
    return rows;
}