import * as CareerRepo from '../repositories/career.repo.js';
import * as MatchHistoryRepo from '../repositories/matchHistory.repo.js';
import { toMatchHistoryDto } from '../mappers/matchHistory.mapper.js';
import { checkTournament, checkUser } from '../utils/checkExist.js';
import { AppError } from '../utils/AppError.js';

/**
 * OD-47 — RW06 "โปรไฟล์ในทัวร์": สถิติของผู้ใช้คนหนึ่ง **ในทัวร์นี้ทัวร์เดียว**
 *
 * **ไม่ผูกกับสวิตช์ OD-46 โดยเจตนา** — เส้นแบ่งคือ "ข้อมูลการแข่งขัน" กับ "ข้อมูลโปรไฟล์"
 * สายการแข่ง ผลแมตช์ รายชื่อลงสนาม และ `GET /matches/:id/stats` เป็นสาธารณะอยู่แล้วทั้งหมด
 * ⇒ ใครก็ไล่บวกสถิติของคนหนึ่งในทัวร์หนึ่งเองได้ เส้นนี้ไม่ได้เปิดเผยอะไรใหม่ แค่บวกให้
 *
 * สิ่งที่ OD-46 กันคือ **การรวมข้ามทัวร์มาไว้หน้าเดียว** (U04 · U14 · RW05) ไม่ใช่การซ่อนผลการแข่ง
 * ถ้าเอาด่าน OD-46 มาใส่เส้นนี้ จะกลายเป็นว่าคนปิดสถิติโปรไฟล์แล้วหายจากหน้าทัวร์ที่ตัวเองลงแข่ง
 * ซึ่งเกินกว่าที่มติกำหนด และทำให้หน้าทัวร์ของผู้จัดมีช่องว่างที่อธิบายไม่ได้
 *
 * ใช้ repo ตัวเดียวกับ U14/RW05 โดยส่ง tournamentId เข้าไปกรอง ⇒ ตัวเลขชุดเดียวกันเป๊ะ
 * ไม่ใช่ SQL ชุดใหม่ที่จะเพี้ยนกันเองวันที่มีใครแก้นิยาม played/wins
 */
export async function getTournamentPlayerStats(tournamentId : number , userId : number){
    await checkTournament(tournamentId);
    await checkUser(userId);

    const careerRows = await CareerRepo.findCareerByUser(userId , tournamentId , true);
    // เอาแถวที่ยัง approved ก่อนเสมอ ให้ผลคาดเดาได้
    //
    // 🔴 แก้คำอธิบาย 6 ต.ค. — เหตุผลเดิมที่เขียนไว้ ("ถอนแล้วสมัครใหม่ มีได้สองใบ") ผิด
    //   ฐานมี application_players UNIQUE (tournament_id, user_id) ⇒ หนึ่งคนมีใบเดียวต่อทัวร์
    //   ⇒ เมื่อกรองด้วย tournamentId แล้ว แถวที่ได้มีได้ **อย่างมากหนึ่งแถว** อยู่แล้ว
    //   ⇒ find() ตรงนี้จึงเป็นการกันไว้ ไม่ใช่การเลือกจากสองแถวที่เกิดขึ้นจริง
    // ★ ไม่ถอดออก เพราะถ้าวันหนึ่ง unique key ถูกถอด บรรทัดนี้คือสิ่งที่ทำให้ผลยังคาดเดาได้
    //   (ถ้าถอดออกแล้วใช้ careerRows[0] เฉย ๆ ผลจะขึ้นกับลำดับที่ MySQL คืนมา)
    const career = careerRows.find(row => row.has_approved === 1) ?? careerRows[0];
    if(!career){
        // ไม่เคยอยู่ในรายชื่อของทัวร์นี้เลย ⇒ "โปรไฟล์ของคนนี้ในทัวร์นี้" ไม่มีอยู่จริง
        //
        // flow ปกติกดมาไม่ถึงตรงนี้ (ไม่มีชื่อให้กด) แต่เส้นนี้สาธารณะและเดา URL ได้
        // ถ้าตอบ 200 + played 0 จะเท่ากับยืนยันว่า "อยู่ในทัวร์นี้ แค่ยังไม่ได้ลงแข่ง" ซึ่งไม่จริง
        //
        // สองกรณีที่ **ไม่** ใช่ 404: (ก) อยู่ในรายชื่อแต่ยังไม่ลงสนาม → 200 + played 0
        // (ข) ทีมถอนตัวหลังแข่งไปแล้ว → 200 + withdrawn true (แก้ 2 ต.ค. · ดู includeWithdrawn)
        throw new AppError(404 , 'PLAYER_NOT_IN_TOURNAMENT' , 'ผู้ใช้นี้ไม่ได้อยู่ในรายชื่อผู้เข้าแข่งขันของทัวร์นาเมนต์นี้');
    }

    const rows = await MatchHistoryRepo.findVerifiedMatchHistoryByUser(userId , tournamentId , true);
    const stats = await MatchHistoryRepo.findStatsForUserMatches(userId , rows.map(row => row.match_id));

    const byMatch = new Map<number , MatchHistoryRepo.MatchHistoryStatRow[]>();
    for(const stat of stats){
        const current = byMatch.get(stat.match_id) ?? [];
        current.push(stat);
        byMatch.set(stat.match_id , current);
    }

    return {
        tournament : { id : career.tournament_id , name : career.tournament_name ,
                       sportTypeId : career.sport_type_id , status : career.tournament_status },
        team : { id : career.team_id , name : career.team_name },
        played : Number(career.played),
        wins : Number(career.wins),
        losses : Number(career.losses),
        champion : career.champion === 1,
        /**
         * ทีมถอนตัวจากทัวร์นี้ไปแล้ว แต่สถิติที่ลงแข่งจริงยังนับ (แก้ 2 ต.ค.)
         *
         * M19 รายชื่อผู้เล่นแสดงคนของทีมที่ถอนตัวอยู่แล้วโดยเจตนา (มติ 26 ก.ย. — แมตช์ที่แข่งไปแล้ว
         * ต้องบอกได้ว่าใครลงสนาม) ⇒ ถ้าเส้นนี้ไม่รับ ชื่อจะกดได้แต่กดไปเจอ 404
         *
         * FE ควรติดป้ายว่า "ทีมถอนตัวแล้ว" ไม่ใช่แสดงเหมือนทีมที่ยังแข่งอยู่
         * หมายเหตุ: U14/RW05 (หน้าโปรไฟล์) ยังไม่นับใบที่ถอน ⇒ ตัวเลขสองหน้าจะไม่เท่ากันในเคสนี้
         * เป็นเรื่องที่ยกให้ทีมตัดสินแยก
         * (OD-47 · `TO-TEAM-2026-10-02-withdrawn-stats.md` ข้อ ก — "ให้ U14/RW05 นับใบที่ถอนด้วยไหม")
         */
        withdrawn : career.has_approved === 0,
        playerStats : sumStats(stats),
        matches : rows.map(row => toMatchHistoryDto(row , byMatch.get(row.match_id) ?? [])),
    };
}

/**
 * รวมสถิติรายแมตช์เป็นยอดของทัวร์นี้ · เรียงตามที่ repo ส่งมา (display_order ของกีฬานั้น)
 *
 * ช่องที่กรรมการไม่ได้กรอก (`value_int` เป็น null) ถือว่า **ไม่มีข้อมูล ไม่ใช่ 0**
 * ⇒ ถ้าทุกแมตช์ว่าง ยอดรวมเป็น null ไม่ใช่ 0 · ถ้ามีกรอกบางแมตช์ จะบวกเฉพาะแมตช์ที่กรอก
 * (กฎเดียวกับที่ `playerStats` รายแมตช์คืน null ไม่ใช่ 0 — ดู matchHistory.mapper)
 */
function sumStats(stats : MatchHistoryRepo.MatchHistoryStatRow[]){
    const totals = new Map<string , { statKey : string; statLabelTh : string; value : number | null }>();
    for(const stat of stats){
        const current = totals.get(stat.stat_key)
            ?? { statKey : stat.stat_key , statLabelTh : stat.stat_label_th , value : null };
        if(stat.value_int !== null){
            current.value = (current.value ?? 0) + stat.value_int;
        }
        totals.set(stat.stat_key , current);
    }
    return [...totals.values()];
}
