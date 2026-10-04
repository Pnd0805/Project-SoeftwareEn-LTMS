import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // 🔴 OD-62 — '**/dist/**' สำคัญ: dist/ มีเทสที่คอมไพล์ไว้ตั้งแต่ 19 ก.ย. 51 ไฟล์
    // vitest เก็บมารันด้วย ⇒ เลข "เทสผ่าน" เดิมรวมเทสของโค้ดเวอร์ชันเก่าที่ไม่มีใครแก้แล้ว
    // และเทสใน dist import dist/config/db.js ⇒ ด่าน noRealIO (mock src/config/*.ts) กันไม่ถึง
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.slow.test.ts'],
    // OD-62 — ด่านกันเทสออกไปแตะของจริง: MySQL · S3/MinIO · SMTP
    // ใช้กับทุกไฟล์เทสโดยไม่ต้องไปเพิ่มอะไรในไฟล์ · ไฟล์ที่ mock เองอยู่แล้วทับได้ตามปกติ
    setupFiles: ['src/__tests__/setup/noRealIO.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/__tests__/**',
        'src/**/*.d.ts',
        'src/server.ts',
        'src/types/**',
      ],
    },
  },
});
