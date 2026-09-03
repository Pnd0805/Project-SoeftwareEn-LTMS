import pool from "../config/db.js";
import type { RowDataPacket , ResultSetHeader} from 'mysql2';
import type { UserRow } from "../types/db.js";

export async function findByEmail(email : string): Promise<UserRow | null>{
    const [rows] = await pool.query<(UserRow & RowDataPacket)[]>('SELECT * FROM users WHERE email = ?',[email]);
    const user = rows[0];

    return user ?? null;
}

export async function findById(userId : number): Promise<UserRow | null>{
    const [ rows ] = await pool.query<(UserRow & RowDataPacket)[]>('SELECT * FROM users WHERE user_id = ?',[userId]);
    const user = rows[0];

    return user ?? null;
}

type NewUser = {
  fullName: string;
  email: string;
  passwordHash: string;
  gender: 'male' | 'female' | 'other';
  birthDate: string;
  facultyId: number;
  departmentId: number;
  year: number;
};

export async function create(data: NewUser): Promise<number>{
    const [ result ] = await pool.query<(ResultSetHeader)>(`INSERT INTO users(full_name , email , 
        password_hash , gender , birth_date , user_type , faculty_id , department_id , year) VALUES (? , ? , ? ,? ,? , 'student' , ? ,? ,?)`,
       [data.fullName , data.email , data.passwordHash , data.gender , data.birthDate , data.facultyId , data.departmentId ,data.year]); 
    
    return result.insertId;
}