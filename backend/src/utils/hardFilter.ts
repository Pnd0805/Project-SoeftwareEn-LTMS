/**
 * Hard Filter — เพศและอายุ · สูตรกลางที่ทุกที่ต้องเรียกตัวเดียวกัน
 *
 * 🔴 แยกออกมาเมื่อ 7 ต.ค. 2569 (BE-36) — เดิม `calculateAge` เป็นฟังก์ชันส่วนตัวใน
 *   `application.service.ts` และเงื่อนไขเพศ/อายุเขียนอยู่ในลูปตรวจใบสมัครที่เดียว
 *   แต่ BE-36 ต้องตรวจ **ย้อนหลัง** ว่าทีมที่อนุมัติไปแล้วยังผ่านเงื่อนไขใหม่ไหม
 *   ถ้าเขียนกฎขึ้นมาใหม่ที่ฝั่งนั้น จะมีสองสูตรที่เถียงกันได้ ⇒ ทีมอาจผ่านตอนสมัคร
 *   แล้วถูกตีว่าไม่ผ่านตอนแก้กฎ (หรือกลับกัน) โดยไม่มีใครรู้ว่าสูตรไหนถูก
 *
 * ★ อยู่ใน utils/ เพราะต้องใช้จากสอง service (`application` ตอนสมัคร · `tournament`
 *   ตอนอนุมัติคำขอแก้ไข) และ service เรียก service ข้ามกันไปมาทำให้วนลูปได้
 *   เหตุผลเดียวกับ `utils/adminScope.ts` และ `utils/matchFormat.ts`
 *
 * ★ ที่นี่มีแค่ **เพศกับอายุ** ไม่รวมชั้นปี/คณะ — สองอย่างนั้นเป็น "กฎคุณสมบัติ"
 *   (`eligibility_rules`) ซึ่งมีด่าน `ensureEligibilityEditable` คุมการแก้อยู่แล้ว
 *   ⇒ BE-36 เกิดเฉพาะกับเพศ/อายุ ซึ่งไม่มีด่านอะไรเลย
 */

export type FilterablePerson = {
    gender : 'male' | 'female' | 'other';
    birth_date : string;
};

export type GenderAgeRules = {
    genderRequirement : 'any' | 'male' | 'female';
    minAge : number | null;
    maxAge : number | null;
    /** วันที่ใช้คิดอายุ — ระบบใช้ **วันปิดรับสมัคร** ไม่ใช่วันนี้ (อายุต้องคงที่ตลอดทัวร์) */
    asOf : Date | string;
};

/**
 * อายุเต็มปี ณ วันที่กำหนด
 * ★ คิดด้วย UTC ทุกช่อง — `birth_date` เป็นวันที่ล้วน (pool ตั้ง dateStrings) ถ้าผสม
 *   local time จะเพี้ยนไป 1 ปีสำหรับคนที่เกิดต้น/ปลายปีในบางโซนเวลา
 */
export function calculateAge(birthDate : string, asOfDate : Date | string): number {
    const birth = new Date(birthDate);
    const asOf = asOfDate instanceof Date ? asOfDate : new Date(asOfDate);
    let age = asOf.getUTCFullYear() - birth.getUTCFullYear();
    const hasHadBirthdayThisYear =
        asOf.getUTCMonth() > birth.getUTCMonth() ||
        (asOf.getUTCMonth() === birth.getUTCMonth() && asOf.getUTCDate() >= birth.getUTCDate());
    if (!hasHadBirthdayThisYear) age -= 1;
    return age;
}

/**
 * คนนี้ตกเงื่อนไขเพศ/อายุด้วยเหตุอะไร — `null` = ผ่าน
 * ★ คืน "เหตุผล" ไม่ใช่ boolean เพราะทั้งสองฝั่งที่เรียกต้องบอกผู้ใช้ให้ได้ว่าตกเพราะอะไร
 *   (ใบสมัคร → `HARD_FILTER_FAILED.details` · คำขอแก้ไข → รายชื่อทีมที่จะผิดกฎ)
 */
export function genderAgeFailReason(person : FilterablePerson, rules : GenderAgeRules): 'gender' | 'age' | null {
    if (rules.genderRequirement !== 'any' && person.gender !== rules.genderRequirement) return 'gender';

    const age = calculateAge(person.birth_date, rules.asOf);
    if (rules.minAge !== null && age < rules.minAge) return 'age';
    if (rules.maxAge !== null && age > rules.maxAge) return 'age';
    return null;
}
