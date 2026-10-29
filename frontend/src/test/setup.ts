/**
 * src/test/setup.ts
 *
 * รันก่อนทุกไฟล์เทสต์ (ตั้งใน vite.config.ts → test.setupFiles)
 * เพิ่ม matcher ของ jest-dom เช่น toBeInTheDocument / toHaveTextContent
 * และล้าง DOM ให้ทุกเทสต์เริ่มจากหน้าเปล่า ไม่งั้นเทสต์ก่อนหน้าจะปนเข้ามา
 */
import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

afterEach(cleanup)
