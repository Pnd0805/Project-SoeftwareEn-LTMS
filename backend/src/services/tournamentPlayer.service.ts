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

    const careerRows = await CareerRepo.findCareerByUser(userId , tournamentId);
    const career = careerRows[0];
    if(!career){
        // ไม่เคยอยู่ในรายชื่อที่ผ่านของทัวร์นี้ ⇒ "โปรไฟล์ของคนนี้ในทัวร์นี้" ไม่มีอยู่จริง
        // ต่างจากกรณีอยู่ในรายชื่อแต่ยังไม่ได้ลงสนาม ซึ่งมีแถวและ played = 0
        throw new AppError(404 , 'PLAYER_NOT_IN_TOURNAMENT' , 'ผู้ใช้นี้ไม่ได้อยู่ในรายชื่อผู้เข้าแข่งขันของทัวร์นาเมนต์นี้');
    }

    const rows = await MatchHistoryRepo.findVerifiedMatchHistoryByUser(userId , tournamentId);
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
