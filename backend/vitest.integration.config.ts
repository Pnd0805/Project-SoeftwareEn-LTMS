import { defineConfig } from 'vitest/config';

/**
 * API integration test — `npm run test:int`
 *
 * ต่างจาก vitest.config.ts (unit) ตรงที่ต่อ MySQL จริง (ฐาน ltms_test แยกจากฐาน dev)
 *   globalSetup : สร้างฐานเทสใหม่ทั้งก้อนครั้งเดียวต่อการรัน (schema.sql + migration ที่เหลือ)
 *   setupFiles  : โหลด .env.test · SMTP → mailbox · บล็อก S3 · ล้างฐานก่อนทุกเทส
 *
 * ★ ไม่ใช้ noRealIO.ts — ไฟล์นั้นบล็อก MySQL ซึ่งเป็นสิ่งที่ integration test ต้องใช้
 * ★ fileParallelism: false — ทุกไฟล์ใช้ฐานเดียวกัน และ resetDb() ล้างทั้งฐาน
 *   ถ้ารันขนานกัน ไฟล์หนึ่งจะลบข้อมูลของอีกไฟล์กลางเทส ⇒ เทสแดงแบบสุ่ม
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.int.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    globalSetup: ['src/__tests__/integration/setup/globalSetup.ts'],
    setupFiles: ['src/__tests__/integration/setup/perFile.ts'],
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 120_000,
  },
});
