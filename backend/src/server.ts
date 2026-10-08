import {env} from './config/env.js';
import app from './app.js';
import { configureKeepAlive } from './config/keepAlive.js';

const PORT = env.PORT;

const server = app.listen(PORT , () => {
    console.log(`Server is running at http://localhost:${PORT}/`);
});

// C4 — ต้องตั้งหลัง listen() เพราะ object ของเซิร์ฟเวอร์เพิ่งมีตอนนั้น
// เหตุผลเต็ม (และทำไม headersTimeout ต้องมากกว่า) อยู่ใน config/keepAlive.ts
configureKeepAlive(server);