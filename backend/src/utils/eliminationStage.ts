/**
 * 🆕 FE-32 (7 ต.ค. 2569 · มติ ข) — ตารางอันดับของทัวร์แบบแพ้คัดออกต้องบอกว่า "ตกรอบไหน"
 *
 * ปัญหาที่ FE รายงาน: `GET /tournaments/:id/standings` ใช้กับทุกรูปแบบการแข่งเหมือนกันหมด
 * และเรียงด้วย `แต้ม → ผลต่างสกอร์ → สกอร์ได้ → จำนวนชนะ`
 * ⇒ ในทัวร์แพ้คัดออก **ทุกทีมที่ตกรอบเดียวกันจะได้อันดับเท่ากันหมด** และไม่มีอะไรบอกว่า
 *   "อันดับ 5 ร่วม 4 ทีม" หมายถึงตกรอบ 8 ทีมสุดท้าย ⇒ คนอ่านตีความไม่ได้
 *
 * ★ กฎที่ใช้คือความหมายตรงตัวของคำว่า "ตกรอบ N ทีมสุดท้าย":
 *   N = จำนวนทีมที่ยังไม่ตกรอบ **ก่อน** รอบนั้นจะเริ่ม
 *   ⇒ ไม่ต้องรู้ว่าสายมีกี่รอบ ไม่ต้องสมมติว่าจำนวนทีมเป็นเลขยกกำลังสอง
 *     และใช้ได้กับทัวร์ที่มีทีมบายในรอบแรกด้วย (ซึ่ง 2^n จะคำนวณผิด)
 *
 * ★ "ตกรอบ" ไม่ใช่ "แพ้" — สองคำนี้ต่างกันใน double elimination
 *     single : แพ้ในสาย winners = ตกรอบทันที
 *     double : แพ้ในสาย winners ยังไม่ตกรอบ (ไหลไปสาย losers)
 *              ตกรอบเมื่อแพ้ใน losers หรือแพ้ grand final
 *   ⇒ "ประตูที่ทำให้ตกรอบ" จึงอยู่คนละสายตามรูปแบบ และแต่ละทีมเดินผ่านมันได้ครั้งเดียว
 *     ทำให้ลำดับรอบที่ตกเป็นค่าที่เรียงได้จริง ไม่ต้องเทียบเวลาข้ามสาย
 *
 * 🔴 round_robin คืน null ทุกทีมโดยเจตนา — ที่นั่น `rank` คือคำตอบจริงอยู่แล้ว
 *   การใส่ป้าย "ตกรอบ" ให้ลีกที่ทุกทีมแข่งครบจะเป็นข้อมูลผิด ไม่ใช่ข้อมูลที่ขาด
 */

export type EliminationBracketType = 'winners' | 'losers' | 'grand_final';

/** โหนดในสายที่ผลจบแล้ว — ผู้แพ้คือฝ่ายที่ไม่ใช่ `winner_team_id` */
export type SettledBracketNode = {
    bracket_type : EliminationBracketType;
    round : number | null;          // NULL = grand_final (ตาม schema)
    team_a_id : number | null;
    team_b_id : number | null;
    winner_team_id : number;
};

export type BracketFormat = 'single_elimination' | 'double_elimination' | 'round_robin' | null;

/** รอบที่ทำให้ "ตกรอบ" อยู่สายไหนของรูปแบบนี้ — null = รูปแบบนี้ไม่มีการตกรอบ */
function eliminatesIn(format : BracketFormat): EliminationBracketType[] | null {
    if(format === 'single_elimination') return ['winners'];
    if(format === 'double_elimination') return ['losers', 'grand_final'];
    return null;
}

/**
 * ค่าเรียงลำดับของ "รอบที่ตก" — เล็กกว่า = ตกก่อน
 * ★ grand_final มี `round` เป็น NULL ตาม schema จึงต้องถูกดันไปท้ายสุดด้วยมือ
 *   ถ้าปล่อยให้ `?? 0` มันจะกลายเป็นรอบแรกสุด แล้วรองแชมป์จะถูกนับว่าตกรอบแรก
 */
function stageOf(node : SettledBracketNode): number {
    return node.bracket_type === 'grand_final' ? Number.MAX_SAFE_INTEGER : (node.round ?? 0);
}

function loserOf(node : SettledBracketNode): number | null {
    if(node.team_a_id === node.winner_team_id) return node.team_b_id;
    if(node.team_b_id === node.winner_team_id) return node.team_a_id;
    // ผู้ชนะไม่ใช่ทีมใดในโหนดนี้ (ข้อมูลเพี้ยน) — ไม่เดา ไม่ติดป้าย
    return null;
}

/**
 * ป้าย "ตกรอบ/รองแชมป์/แชมป์" ของทุกทีมในทัวร์ — คืน Map<teamId, label | null>
 *
 * `null` = ยังไม่ตกรอบและยังไม่รู้ว่าจะเป็นอะไร (ทัวร์ยังไม่จบ) หรือรูปแบบนี้ไม่มีการตกรอบ
 *
 * @param teamIds ทีมทั้งหมดที่อยู่ในตารางอันดับ — ใช้เป็นตัวตั้งของ "N ทีมสุดท้าย"
 */
export function eliminationLabels(
    format : BracketFormat,
    nodes : SettledBracketNode[],
    teamIds : number[]
): Map<number, string | null> {
    const labels = new Map<number, string | null>(teamIds.map(id => [id, null]));

    const brackets = eliminatesIn(format);
    if(brackets === null || teamIds.length === 0) return labels;

    // รอบที่แต่ละทีมตก — ทีมหนึ่งตกได้ครั้งเดียว แต่ถ้าข้อมูลซ้ำ ให้ยึดรอบท้ายสุด
    const stageByTeam = new Map<number, number>();
    for(const node of nodes){
        if(!brackets.includes(node.bracket_type)) continue;
        const loser = loserOf(node);
        if(loser === null || !labels.has(loser)) continue;
        const stage = stageOf(node);
        if((stageByTeam.get(loser) ?? -1) < stage) stageByTeam.set(loser, stage);
    }
    if(stageByTeam.size === 0) return labels;

    // จัดกลุ่มตามรอบ แล้วเดินจากรอบแรกไปรอบท้าย
    const byStage = new Map<number, number[]>();
    for(const [teamId, stage] of stageByTeam){
        byStage.set(stage, [...(byStage.get(stage) ?? []), teamId]);
    }
    const stages = [...byStage.keys()].sort((a, b) => a - b);

    let remaining = teamIds.length;
    for(const stage of stages){
        const group = byStage.get(stage)!;
        const lastStage = stage === stages[stages.length - 1];
        /**
         * ★ รองแชมป์ = คนเดียวที่ตกในรอบท้ายสุด และตกแล้วเหลือทีมเดียว
         *   เขียนเงื่อนไขทั้งสองข้อ ไม่ใช่แค่ "รอบท้ายสุด" — ทัวร์ที่ยังแข่งไม่จบก็มีรอบท้ายสุด
         *   ของมันเหมือนกัน ถ้าเช็คแค่ข้อแรกทีมที่ตกรอบ 8 ทีมสุดท้ายจะได้ป้าย "รองแชมป์"
         *   ระหว่างที่ทัวร์ยังแข่งอยู่
         */
        const isRunnerUp = lastStage && group.length === 1 && remaining - group.length === 1;
        for(const teamId of group){
            labels.set(teamId, isRunnerUp ? 'รองแชมป์' : `ตกรอบ ${remaining} ทีมสุดท้าย`);
        }
        remaining -= group.length;
        // แชมป์ = ทีมเดียวที่เหลือหลังรอบชิงจบ (เงื่อนไขเดียวกับที่ทำให้มีรองแชมป์)
        if(isRunnerUp){
            for(const teamId of teamIds){
                if(!stageByTeam.has(teamId)) labels.set(teamId, 'แชมป์');
            }
        }
    }
    return labels;
}
