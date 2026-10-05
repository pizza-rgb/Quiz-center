# เว็บติวกฎหมายแรงงาน 50 ข้อ

ระบบ: สมัคร/เข้าสู่ระบบ, บันทึกคำตอบแยกบัญชี, ทำต่อหลังรีเฟรช, ตรวจทันทีรายข้อ, แสดงคำอธิบาย, ไปข้อถัดไป, คะแนนรวม

## ตั้งค่า Supabase
1. สร้าง Project ที่ https://supabase.com
2. เปิด Email Authentication
3. รัน `supabase-schema.sql` ใน SQL Editor
4. ใส่ Project URL และ anon public key ใน `config.js`
5. ทดสอบ `index.html`

## Deploy GitHub Pages
อัปโหลดไฟล์ทั้งหมดเข้า repository แล้วไป Settings > Pages > Deploy from a branch > `main` > `/(root)` > Save

**สำคัญ:** ใช้เฉพาะ Supabase anon public key ในเว็บ ห้ามใส่ service_role key
