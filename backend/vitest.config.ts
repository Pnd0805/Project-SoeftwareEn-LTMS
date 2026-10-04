import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // 🔴 OD-62 — '**/dist/**' สำคัญ: dist/ มีเทสที่คอมไพล์ไว้ตั้งแต่ 19 ก.ย. 51 ไฟล์
    // vitest เก็บมารันด้วย ⇒ เลข "เทสผ่าน" เดิมรวมเทสของโค้ดเวอร์ชันเก่าที่ไม่มีใครแก้แล้ว
    // และเทสใน dist import dist/config/db.js ⇒ ด่าน noRealDb (mock src/config/db.ts) กันไม่ถึง
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.slow.test.ts'],
    // OD-62 — ด่านกันเทสไปต่อ MySQL จริง · ใช้กับทุกไฟล์เทสโดยไม่ต้องไปเพิ่มอะไรในไฟล์
    // ไฟล์ที่ mock config/db.js เองอยู่แล้วทับอันนี้ได้ตามปกติ (ดูคอมเมนต์ในไฟล์ setup)
    setupFiles: ['src/__tests__/setup/noRealDb.ts'],
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
