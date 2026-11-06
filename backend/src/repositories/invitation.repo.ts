import pool from '../config/db.js';
import type { SportTypeRow } from '../types/db.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { AppError } from '../utils/AppError.js';

export async function createAcceptInvite(invitedId : number , teamId : number , userId : number) : Promise<number>{
    const conn = await pool.getConnection();
    try{
        await conn.beginTransaction();

        const [ answered ] = await conn.query<ResultSetHeader>(`UPDATE team_invitations SET team_invitation_status = ? , responded_at = NOW()
                                           WHERE team_invitation_id = ? AND expires_at > NOW() AND team_invitation_status = ?`
                                           ,['accepted' , invitedId , 'pending']);
        /**
         * 🔴 30 ต.ค. 2569 (QA ข้อ 10) — ต้องดู affectedRows ไม่ใช่ยิง UPDATE แล้วเดินต่อ
         *   service เช็คสถานะ/วันหมดอายุไว้ก่อนแล้วก็จริง แต่ระหว่างนั้นคำเชิญอาจหมดอายุ
         *   หรือถูกตอบจากอีกแท็บ ⇒ UPDATE ไม่โดนแถวไหนเลย **แต่เดิมยังเพิ่มคนเข้าทีมอยู่ดี**
         *   ⇒ ได้สมาชิกใหม่จากคำเชิญที่ไม่เคยถูกตอบรับ และแถวคำเชิญยังค้าง pending
         * ★ ท่าเดียวกับ reset token (`markUsed`) และคำขอเข้าร่วมทีม — UPDATE แบบมีเงื่อนไขคือตัวตัดสิน
         */
        if(answered.affectedRows === 0){
            throw new AppError(409 , 'INVITATION_ALREADY_ANSWERED' ,
                'คําเชิญนี้ถูกตอบรับ/ปฏิเสธไปแล้ว หรือหมดอายุระหว่างทาง กรุณารีเฟรชหน้าจอ');
        }

        const [result] = await conn.query<ResultSetHeader>('INSERT INTO team_members(team_id , user_id) VALUES( ? , ? )',[teamId , userId]);

        const [count] = await conn.query<({memberCount : number} & RowDataPacket)[]>('SELECT count(*) as memberCount FROM team_members WHERE team_id = ?',
                                                                                [teamId]);
        const [ minMember ] = await conn.query<(Pick<SportTypeRow , 'min_members'> & RowDataPacket)[]>(`SELECT s.min_members
                                                                                                        FROM sport_types s JOIN teams t ON t.sport_type_id = s.sport_type_id
                                                                                                        WHERE t.team_id = ? AND t.deleted_at IS NULL` , [teamId]);

        /**
         * 🔴 30 ต.ค. 2569 (QA ข้อ 9) — ทีมถูกลบระหว่างทางแล้วคิวรีข้างบนไม่ได้แถวกลับมา
         *   เดิมเป็น `minMember[0]!.min_members` ⇒ TypeError ⇒ ผู้ใช้เห็น 500 INTERNAL_ERROR
         *   (transaction ถูก rollback อยู่แล้ว ข้อมูลไม่เสียหาย แต่ข้อความผิดและ log รกด้วย stack ที่ไม่ใช่บั๊ก)
         * ★ ด่านจริงอยู่ที่ service (เช็ค deleted_at ก่อนเรียก) — ตรงนี้คือตะแกรงกันกรณีลบแทรกกลางคัน
         */
        const sport = minMember[0];
        if(!sport){
            throw new AppError(404 , 'TEAM_NOT_FOUND' , 'ทีมนี้ถูกลบไปแล้ว');
        }

        if(count[0]!.memberCount >= sport.min_members){
            await conn.query<ResultSetHeader>('UPDATE teams SET readiness_status = ? , updated_at = NOW() WHERE team_id = ?',['Ready' , teamId]);
        }

        await conn.commit();
        return result.insertId
    }catch(err){
        await conn.rollback();
        throw err;

    }finally{
        conn.release();
    }
}

export async function createRejectInvite(invitedId : number , userId : number) :Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>(`UPDATE team_invitations SET team_invitation_status = ? , responded_at = NOW()
                                                          WHERE team_invitation_id = ? AND invited_user_id = ? AND team_invitation_status = ?`
                                                          , ['rejected' , invitedId , userId , 'pending']);
    return result.affectedRows;
}
