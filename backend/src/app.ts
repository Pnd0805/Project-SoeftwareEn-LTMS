import express from 'express';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { slowRequestLog } from './middlewares/slowRequestLog.js';

import App from './routes/index.js';

const app = express();

// C2 — ต้องอยู่ **บนสุด** ก่อน express.json() เพื่อให้นับเวลาทั้งเส้น รวมการอ่าน body
// (คำขอที่ body ใหญ่หรือเน็ตช้า ใช้เวลาตั้งแต่ก่อนเข้า route แล้ว)
app.use(slowRequestLog);

app.use(express.json());

app.use('/api/v1' , App);

app.use(notFound);
app.use(errorHandler);

export default app;