import type { Request , Response , NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import * as MatchRepo from '../repositories/match.repo.js';
import { findVisibleTournament } from '../services/tournament.service.js';

const READ = new Set(['GET' , 'HEAD']);

/**
 * 🔴 A2 (integration test เจอ 6 ต.ค. 2569) — ปิดรูข้อมูลรั่วของทัวร์ที่ยังไม่เผยแพร่
 *
 * `GET /tournaments/:id` ตอบ 404 กับทัวร์ private/pending/rejected มาตลอด (getVisibleTournament)
 * แต่ **endpoint ข้างเคียงไม่ได้ผ่านด่านเดียวกัน** ⇒ คนที่ไม่ล็อกอินอ่านของจริงได้จาก
 *   /tournaments/:id/matches · /tournaments/:id/teams · /matches/:id ⇒ คู่แข่งขัน + ชื่อทีม
 *   /bracket · /standings · /winner · /dashboard · /announcements · /pickem-leaderboard …
 * กรณีจริง: ผู้จัดได้รับอนุมัติแล้ว (private) จับสายไว้ก่อนเผยแพร่
 *   ⇒ สายการแข่งหลุดก่อนเปิดตัว ขณะที่หน้าหลักยืนยันว่า "ไม่มีทัวร์นี้"
 *
 * ★ ทำเป็น middleware ที่ mount ครั้งเดียวใต้ /tournaments/:id และ /matches/:id แบบเดียวกับ
 *   lockCompletedTournament — ไม่ไล่แก้ทีละ controller เพราะเส้นที่รั่วมี 16 เส้น และเส้นที่
 *   จะเพิ่มในอนาคตจะได้ด่านนี้ไปด้วยโดยไม่มีใครต้องนึกถึง (เหตุผลเดียวกับที่ B1 เลือกทางนี้)
 * ★ กันเฉพาะ **การอ่าน** — การเขียนมีด่านของตัวเองอยู่แล้ว (requireAuth + requireOrganizer /
 *   requireTeamLeader / requireReferee) และคนที่มีสิทธิ์เขียนบางคนไม่ได้อยู่ในนิยาม "มองเห็น"
 *   (เช่น หัวหน้าทีมที่กำลังถอนตัว) ⇒ เอาด่านนี้ไปคุมการเขียนจะเปลี่ยนพฤติกรรมเกินขอบเขต A2
 * ★ "ใครมองเห็น" ใช้ตัวเดียวกับ GET /tournaments/:id (findVisibleTournament) ไม่เขียนกฎซ้ำ
 *   ⇒ ผู้จัด · แอดมินที่ดูแลทัวร์นั้น · กรรมการที่ถูกเชิญ ยังอ่านได้ครบเหมือนเดิม
 */
export async function requireVisibleTournamentForReads(req : Request , res : Response , next : NextFunction){
    try{
        if(!READ.has(req.method)) return next();

        const id = Number(req.params['id']);
        // id ไม่ใช่ตัวเลข = ไม่ใช่เส้นที่เราคุม ปล่อยให้ route จริงตอบ 400/404 ตามรูปแบบของตัวเอง
        if(!Number.isInteger(id) || id <= 0) return next();

        const matchRoute = req.baseUrl.endsWith(`/matches/${id}`);
        let tournamentId = id;
        if(matchRoute){
            const match = await MatchRepo.findById(id);
            if(!match) return next();   // ไม่มีแมตช์นี้ → ให้ route ตอบ MATCH_NOT_FOUND เอง
            tournamentId = match.tournament_id;
        }
        // GET /tournaments/:id ตรง ๆ มีด่านในตัวแล้ว — ข้ามเพื่อไม่ให้อ่านฐานซ้ำสองรอบ
        else if(req.path === '/') return next();

        try{
            await findVisibleTournament(tournamentId , req.user?.user_id);
        }catch(err){
            // ทัวร์มองไม่เห็น = แมตช์นั้นไม่มีอยู่ในสายตาผู้เรียก — ตอบด้วยคำที่ตรงกับเส้นที่เรียก
            // (แบบเดียวกับ lockCompletedTournament) ไม่ให้ชื่อ error ไปบอกว่า "ทัวร์นี้มีอยู่จริงนะ"
            if(matchRoute && err instanceof AppError && err.status === 404){
                return next(new AppError(404 , 'MATCH_NOT_FOUND' , 'ไม่พบแมตช์นี้'));
            }
            throw err;
        }
        next();
    }catch(err){
        next(err);
    }
}
