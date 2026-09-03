import { AppError } from "./AppError.js";

/**
 * @param raw   ค่าดิบจาก req.params — Express 5 ให้ชนิด string | string[] | undefined
 * @param label ชื่อของสิ่งที่ตรวจ ใช้ประกอบข้อความ เช่น 'รหัสคณะ'
 * @param field ชื่อ key ใน fields ที่ frontend ใช้หาว่าช่องไหนผิด (ค่าเริ่มต้น 'id')
 */
export function parseId(raw: string | string[] | undefined, label: string, field = 'id'): number {
    const id = Array.isArray(raw) ? NaN : Number(raw);

    if (!Number.isInteger(id) || id < 1) {
        const fields = { [field]: `${label}ต้องเป็นจำนวนเต็มบวก` };
        throw new AppError(400, 'VALIDATION_FAILED',
            'ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบและกรอกใหม่', { fields });
    }

    return id;
}
