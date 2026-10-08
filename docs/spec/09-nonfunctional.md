# 09 — Non-Functional and Architecture Requirements

**Status:** Current  
**Last reviewed:** 2026-09-15

## 1. Architecture

LTMS ใช้ 3-tier architecture:

- Client: React/Vite/TypeScript
- Application/API: Node.js + Express.js + Docker
- Database: Amazon RDS relational database

Frontend ห้าม query database โดยตรง

Current SRS/SDS v1.2 architecture ใช้ RDS เป็น source of truth ของ bracket/tree และ dynamic sport statistics ด้วย ไม่ใช้ MongoDB เป็น canonical store

## 2. Communication

- production communication ใช้ HTTPS
- API payload หลักเป็น JSON/REST
- authenticated request ใช้ server-validated JWT
- UI authorization ไม่สามารถแทน server-side authorization ได้

## 3. Validation

ข้อมูลต้อง validate ทั้ง client และ server

- client validation เพื่อ UX
- server validation เพื่อ integrity/security

Server ต้อง reject unsupported/invalid fields แทน silent acceptance ที่ทำให้ behavior กำกวม

## 4. Security

- password hash + salt; ห้าม plaintext
- password/token/identity evidence ห้ามเข้า application log
- authorization ตรวจทั้ง system-level role และ resource context
- ป้องกัน SQL injection, XSS และ IDOR/resource-guessing
- sensitive evidence ใช้ controlled/presigned access
- important administrative/competition actions ต้อง audit ได้

## 5. Privacy / PDPA

ภาพบัตรหรือ identity evidence เป็นข้อมูลส่วนบุคคลอ่อนไหวในบริบทระบบ:

- เก็บเฉพาะเมื่อจำเป็น
- จำกัดผู้เข้าถึง
- มี retention/deletion policy
- ไม่ expose object-storage key/URL ที่ใช้งานถาวรแบบ public

## 6. Reliability

- result verification + bracket/standing/stat updates ต้อง atomic/logically atomic
- duplicate submissions ที่เป็น idempotent operation ต้องไม่สร้าง duplicate rows/effects
- database backup อย่างน้อยวันละ 1 ครั้ง
- backup retention อย่างน้อย 7 วัน
- ควรทดสอบ restore ก่อน production/course handoff

## 7. Performance Targets from SRS

- read API p95 ≤ 1.5s ภายใต้ 100 concurrent users
- first meaningful content ≤ 2.5s บน 4G สำหรับ core pages
- bracket generation ≤ 5s สำหรับ capacity ≤ 64 teams
- verified result สะท้อนใน bracket/leaderboard ≤ 10s
- QR check-in response ≤ 3s ใน burst scenario ที่กำหนด
- รองรับ 500 concurrent users โดย request error rate ≤ 1% ใน target load test

## 8. Availability

- ช่วง competition/registration target availability ≥ 99% ตาม SRS
- planned downtime ควรแจ้งล่วงหน้าและหลีกเลี่ยงวันแข่งขัน

## 9. Usability

- core UI รองรับ viewport ≥ 360px
- error message สำหรับ user ควรเป็นภาษาไทยและบอกสาเหตุ/วิธีแก้ ไม่ expose internal stack/error detail
- loading/success/error state ต้องชัดใน action ที่เรียก API

## 10. Maintainability

- business logic แยกจาก controller/database access
- bracket algorithm เป็นโมดูลทดสอบได้
- code ใช้ Git/GitHub และ CI ก่อน merge ตาม team workflow
- behavior change ต้อง update central spec ตาม README

## 11. Portability

- API Server containerized ด้วย Docker
- รองรับ current/previous major versions ของ Chrome, Edge, Safari และ Firefox ตาม SRS target

