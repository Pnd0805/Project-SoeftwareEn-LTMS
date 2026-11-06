import type { FacultyRow , DepartmentRow , SportTypeRow , SportStatDefinitionRow } from "../types/db.js"
import { PICKEM_TIER_POINTS } from "../config/scoring.js";

export type FacultyDto = {
    id : number,
    name : string
};

export type DepartmentDto = {
    id : number,
    facultyId : number,
    name : string
}; 

export type SportTypeDto = {
    id : number,
    name : string,
    minMembers : number,
    maxMembers : number,
    defaultMode : 'onsite' | 'online',
    /**
     * 🆕 มติ 7 ต.ค. 2569 (①ก · FE ขอมา) — "กีฬานี้แข่งเป็นรอบ (BO-N) ไหม"
     *
     * true  ⇒ หน้าสร้างทัวร์โชว์ตัวเลือก BO1/BO3/BO5/BO7 ได้ · ส่ง bestOf มาได้
     * false ⇒ ซ่อนตัวเลือกนั้น · ส่ง bestOf มาจะได้ 400 BEST_OF_NOT_SUPPORTED (มติ ②ก)
     *
     * ★ มีอยู่เพื่อให้ FE เลิกจับคู่ "ชื่อกีฬา" ในโค้ดตัวเอง — ค่านี้เป็นของ server
     *   เพิ่มกีฬาใหม่ในฐานแล้ว FE ไม่ต้องแก้โค้ดตาม
     */
    supportsBestOf : boolean,
    /**
     * OD-56 / OD-63 (4 ต.ค. 2569) — เส้นความคลาดของ Pick'em **ต่อฝั่ง** ของกีฬานี้
     *
     * ★ ส่งออกเพราะหน้าทายผลต้องบอกกฎให้ผู้ใช้ **ก่อน** กดส่ง
     *   (บาส: คลาดไม่เกิน 5 แต้ม/ฝั่ง = เต็ม · ไม่เกิน 10 = ชั้นรอง)
     *   ค่าพวกนี้อยู่ใน `sport_types` ⇒ ผู้จัดแก้ได้ ⇒ **FE hardcode ไม่ได้**
     *   ถ้าไม่ส่งออก FE เหลือสองทาง: hardcode (วันไหนมีคนแก้ในฐาน หน้าจอโกหกเงียบ ๆ
     *   เพราะแต้มยังคิดถูกฝั่ง BE) หรือไม่บอกกฎเลย (ผู้ใช้ทายโดยไม่รู้ว่าคลาดได้เท่าไร)
     *
     * `spotOn: 0, close: 0` = กีฬาที่นับเกม (แบด/RoV) ⇒ ชั้นรองไม่ยิงเลยโดยเจตนา
     */
    pickemTolerance : { spotOn : number , close : number },
    /**
     * แต้มของแต่ละชั้น · **ค่าคงที่ทั้งระบบ ไม่ใช่ต่อกีฬา** (มาจาก `config/scoring.ts`)
     *
     * ★ ส่งมาในก้อนเดียวกับ tolerance เพราะเลข 10/7/4 ไม่มีประโยชน์ถ้าไม่รู้เส้น
     *   และเส้นก็ไม่มีประโยชน์ถ้าไม่รู้แต้ม — FE ต้องมีทั้งคู่จึงประกอบประโยคอธิบายกฎได้
     */
    pickemPoints : { spotOn : number , close : number , sideOnly : number }
}; 

export type SportStatDefinitionDto = {
    statDefinitionId : number,
    statKey : string,
    statLabelTh : string,
    dataType : 'integer' | 'decimal' | 'boolean',
    displayOrder : number
};

export function toFacultyDto(row: FacultyRow):FacultyDto {
    return {
        id : row.faculty_id,
        name : row.name
    }
}

export function toDepartmentDto(row : DepartmentRow):DepartmentDto {
    return {
        id : row.department_id,
        facultyId : row.faculty_id,
        name : row.name
    }
}

export function toSportTypeDto(row: SportTypeRow): SportTypeDto{
    return {
        id : row.sport_type_id,
        name : row.name,
        minMembers : row.min_members,
        maxMembers : row.max_members,
        defaultMode : row.default_mode,
        supportsBestOf : row.supports_best_of === 1,
        pickemTolerance : {
            // ★ คีย์ชื่อ spotOn ไม่ใช่ exact ตามชื่อคอลัมน์ — ตั้งใจให้ตรงกับชื่อชั้นใน pickemPoints
            //   FE จะได้จับคู่ tolerance[tier] กับ points[tier] ด้วยคีย์เดียวกัน วนลูปได้
            //   และคำว่า "exact" หลอกว่าต้องตรงเป๊ะ ซึ่งผิด (บาสคลาดได้ 5 แต้ม/ฝั่งแล้วยังอยู่ชั้นนี้)
            //   — เหตุผลเดียวกับที่ `PICKEM_TIER_POINTS` ตั้งชื่อชั้นว่า spot_on ไม่ใช่ exact
            spotOn : row.pickem_tolerance_exact,
            close : row.pickem_tolerance_close
        },
        // อ่านจาก config ตัวเดียวกับที่คิดแต้มจริง (utils/pickemScore.ts) ⇒ แก้ที่เดียว ไม่แยกร่าง
        pickemPoints : {
            spotOn : PICKEM_TIER_POINTS.spot_on,
            close : PICKEM_TIER_POINTS.close,
            sideOnly : PICKEM_TIER_POINTS.side_only
        }
    }
}

export function toSportStatDefinitionDto(row : SportStatDefinitionRow):SportStatDefinitionDto{
    return {
        statDefinitionId : row.sport_stat_definition_id,
        statKey : row.stat_key,
        statLabelTh : row.stat_label_th,
        dataType : row.data_type,
        displayOrder : row.display_order
    };
}
