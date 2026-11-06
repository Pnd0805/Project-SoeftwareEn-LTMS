import request from 'supertest';
import app from '../../../app.js';
import type { TestUser } from './factories.js';

/**
 * ยิง API ผ่าน Express app ในหน่วยความจำ — ไม่เปิดพอร์ต (app.ts ไม่เรียก listen · server.ts เป็นคนเรียก)
 *
 *   await api().get('/api/v1/tournaments')                      ไม่ล็อกอิน
 *   await as(orgA).post(`/api/v1/tournaments/${id}/publish`)    ล็อกอินเป็น orgA
 *
 * ★ ผ่าน middleware ทุกชั้นจริง (requireAuth → requireOrganizer → validate → controller → service → repo → MySQL)
 *   นี่คือสิ่งที่ unit test ทำไม่ได้: unit test mock middleware ⇒ ถ้า route ลืมใส่ requireOrganizer ทุกเทสยังเขียว
 */
export const BASE = '/api/v1';

export function api() {
    return request(app);
}

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** client ที่แนบ Bearer token ของผู้ใช้คนนั้นทุกคำขอ — path ใส่หรือไม่ใส่ /api/v1 นำหน้าก็ได้ */
export function as(user: TestUser | { token: string }) {
    const withAuth = (method: Method) => (path: string) =>
        request(app)[method](path.startsWith(BASE) ? path : `${BASE}${path}`)
            .set('Authorization', `Bearer ${user.token}`);
    return {
        get: withAuth('get'),
        post: withAuth('post'),
        put: withAuth('put'),
        patch: withAuth('patch'),
        delete: withAuth('delete'),
    };
}

/** ไม่ล็อกอิน — path แบบเดียวกับ as() */
export const anon = {
    get: (path: string) => request(app).get(path.startsWith(BASE) ? path : `${BASE}${path}`),
    post: (path: string) => request(app).post(path.startsWith(BASE) ? path : `${BASE}${path}`),
    patch: (path: string) => request(app).patch(path.startsWith(BASE) ? path : `${BASE}${path}`),
    delete: (path: string) => request(app).delete(path.startsWith(BASE) ? path : `${BASE}${path}`),
};
