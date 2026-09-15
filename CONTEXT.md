# LTMS Domain Context

## Glossary

- **Tournament description** — ข้อความสรุปทัวร์นาเมนต์แบบไม่บังคับ ความยาวไม่เกิน 255 ตัวอักษร
- **Tournament scope** — ขอบเขตผู้มีสิทธิ์เข้าร่วมทัวร์นาเมนต์ แบ่งเป็นระดับภาควิชา (`department`) หรือระดับคณะ (`faculty`) ใน MVP
- **University-wide tournament** — ขอบเขตระดับมหาวิทยาลัย (`university`) ที่ยังไม่อยู่ในขอบเขต MVP และต้องผ่านการยืนยันจากทีมก่อน
- **Faculty-scoped tournament** — ทัวร์นาเมนต์ที่ผูกกับคณะหนึ่งคณะ และไม่ผูกกับภาควิชาเฉพาะ
- **Department-scoped tournament** — ทัวร์นาเมนต์ที่ผูกกับภาควิชาหนึ่งภายใต้คณะที่ระบุเดียวกัน
- **Faculty admin scope** — สิทธิ์ Admin ที่ครอบคลุม Tournament ระดับคณะของตนและ Tournament ระดับภาควิชาภายในคณะนั้น
- **University-wide admin scope** — สิทธิ์ Admin ที่ครอบคลุม Tournament ทุกคณะและทุกภาควิชา
- **Registration window** — ช่วงเวลาตั้งแต่ `registrationStart` ถึง `registrationEnd` และต้องจบก่อนวันเริ่มการแข่งขัน
- **Tournament team capacity** — จำนวนทีมที่รับสมัคร โดย `minTeams` ต้องไม่น้อยกว่า 2 และไม่เกิน `maxTeams`
- **Tournament amendment** — คำขอจาก Organizer เพื่อแก้ข้อมูลที่กระทบเงื่อนไขการสมัครและต้องให้ Admin อนุมัติก่อน
- **Accepted referee for publication** — กรรมการระดับ Tournament ที่ตอบรับแล้วอย่างน้อยหนึ่งคนก่อนเปิดเผย Tournament เป็นสาธารณะ
- **Active referee for publication** — กรรมการที่ตอบรับแล้ว และถ้าเป็นกรรมการภายนอกต้องได้รับการอนุมัติจาก Admin แล้วด้วย
- **Tournament lifecycle** — คำขอเริ่มที่ `pending_approval`, เปลี่ยนเป็น `private` หรือ `rejected`, และเฉพาะ `private` จึงเผยแพร่เป็น `public` ได้
- **Bracket format** — รูปแบบการแข่งขันที่ใช้ชื่อเต็ม `single_elimination`, `double_elimination` หรือ `round_robin`
- **Eligibility rule** — เงื่อนไขปีการศึกษาหรือคณะที่เก็บไว้เพื่อให้ระบบใช้ตรวจสิทธิ์ทีม โดย C17 อ่านรายการนี้ได้แม้รายการจะว่าง
- **Registration state** — สถานะแยกจาก lifecycle ของ Tournament: เปิดได้เฉพาะ Tournament ที่เป็น `public` และต้องปิดก่อนทำให้กลับเป็น `private`
- **Private Tournament visibility** — ผู้ใช้ทั่วไปจะไม่ได้รับการยืนยันว่ามี Tournament ที่ยังไม่เผยแพร่หรือถูกปฏิเสธอยู่
- **Tournament venue** — สถานที่จัดการแข่งขันที่ C01 ต้องระบุเป็นข้อความไม่ว่าง ความยาวไม่เกิน 255 ตัวอักษร
- **Tournament event period** — ช่วงวันแข่งขันที่ต้องมีวันเริ่มและวันสิ้นสุด โดยการแข่งขันวันเดียวใช้วันเดียวกันทั้งสองค่า
- **Age eligibility** — ผู้ใช้มีวันเกิด (`birthDate`/`birth_date`) ส่วน Tournament มีขอบเขตอายุเป็นตัวเลข (`minAge`/`maxAge`); ระบบคำนวณอายุเต็มปี ณ `eventStartDate`
- **Age boundary** — `minAge` และ `maxAge` เป็นจำนวนเต็ม 0–120, เป็นค่าว่างได้ และ `minAge` ต้องไม่เกิน `maxAge`
- **Team capacity conflict** — amendment ที่ลด `maxTeams` ต่ำกว่าจำนวนทีมที่อนุมัติแล้วไม่สามารถอนุมัติได้
