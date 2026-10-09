import {env} from './config/env.js';
import app from './app.js';
import { configureKeepAlive } from './config/keepAlive.js';
import { startScheduler } from './jobs/scheduler.js';
import { backgroundJobs } from './jobs/index.js';

const PORT = env.PORT;

const server = app.listen(PORT , () => {
    console.log(`Server is running at http://localhost:${PORT}/`);
});

// C4 — ต้องตั้งหลัง listen() เพราะ object ของเซิร์ฟเวอร์เพิ่งมีตอนนั้น
// เหตุผลเต็ม (และทำไม headersTimeout ต้องมากกว่า) อยู่ใน config/keepAlive.ts
configureKeepAlive(server);

// มติ 8 ต.ค. 2569 — งานกวาดรันตามเวลา ไม่ใช่ตอนมีคนเปิดหน้า
// 🔴 ต้องอยู่ที่นี่ ไม่ใช่ app.ts — app.ts ถูก import โดยเทส integration ทุกไฟล์
//   ถ้าตั้ง timer ที่นั่น ทุกไฟล์เทสจะมีงานเบื้องหลังวิ่งแข่งกับเทส
startScheduler(backgroundJobs);