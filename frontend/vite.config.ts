/// <reference types="vitest/config" />
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // เทสต์อยู่ข้างไฟล์ที่มันทดสอบ — เจ้าของ slice เขียนเทสต์ของตัวเองในโฟลเดอร์ตัวเอง
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
})
