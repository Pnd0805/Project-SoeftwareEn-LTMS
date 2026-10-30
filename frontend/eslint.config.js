import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  // วันเวลาที่แสดงต้องผ่าน src/shared/dateFormat.ts — จัดรูปเองแล้วแต่ละหน้าอ่านไม่เหมือนกัน
  // (อาจารย์ท้วง 27 ต.ค.) · เริ่มที่ slice 3/4 ก่อน ส่วนอื่นเสนอทีมแยก
  {
    files: [
      'src/features/match/**/*.tsx', 'src/features/matches/**/*.tsx', 'src/features/checkin/**/*.tsx',
      'src/features/tournament/LeaderboardTab.tsx', 'src/features/tournament/ScheduleTab.tsx',
      'src/features/team/**/*.tsx', 'src/features/admin/**/*.tsx', 'src/features/request/**/*.tsx',
      'src/features/player/**/*.tsx', 'src/features/tournament/manage/RefereePanel.tsx',
    ],
    ignores: ['**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': ['error',
        {
          selector: "CallExpression[callee.property.name=/^toLocale(Date|Time)String$/]",
          message: 'Format displayed dates with fmtDateTime/fmtDateOnly from src/shared/dateFormat.ts.',
        },
        {
          selector: "CallExpression[callee.property.name='toLocaleString'][callee.object.type='NewExpression'][callee.object.callee.name='Date']",
          message: 'Format displayed dates with fmtDateTime/fmtDateOnly from src/shared/dateFormat.ts.',
        },
      ],
    },
  },
  // E2E (Playwright) รันใน Node ไม่ใช่ React — `use()` ของ fixture ไม่ใช่ React hook
  // และไม่มี component ให้ react-refresh ตรวจ
  {
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
])
