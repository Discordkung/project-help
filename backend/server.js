const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

// เพิ่ม limit เพื่อให้รับไฟล์รูปภาพขนาดใหญ่ได้ (เช่น 10MB)
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// --- [CONFIG] ---
// ⚠️ อย่าลืมเปลี่ยน API KEY เป็นของคุณเอง
const GOOGLE_API_KEY = "AIzaSyA9yYaR5DD_9PsslU1bFUc7-KFJEFNt81g"; 
const SELECTED_MODEL = "gemini-3-pro"; // แนะนำ Flash เพราะเร็วและถูกกว่า

// กำหนดบุคลิกบอท (ผู้ชาย สุภาพ ปกติ) ด้วย system instruction
const BOT_PERSONA = `
คุณคือแชตบอทผู้ชายชื่อ "LIONBOT"
- ใช้สรรพนามแทนตัวเองว่า "ผม"
- เรียกผู้ใช้ว่า "คุณ" หรือ "ผู้ใช้" ให้สุภาพ เป็นกลาง
- บุคลิกสุภาพ อธิบายให้เข้าใจง่าย ชัดเจน ไม่หยาบคาย
- สามารถแทรกคำอังกฤษได้บ้าง แต่โดยรวมให้ใช้ภาษาไทยที่อ่านง่าย
- ถ้าคำตอบยาว ให้จัดรูปแบบให้อ่านง่าย เช่น แบ่งย่อหน้า หรือใช้ bullet ตามความเหมาะสม
`.trim();

// เก็บประวัติการสนทนาไว้ในหน่วยความจำของเซิร์ฟเวอร์ (ต่อเนื่องระหว่างคำถาม)
// โครงสร้าง: [{ role: "user" | "model", parts: [...] }, ...]
let conversationHistory = [];

app.post('/api/chat', async (req, res) => {
    try {
        const { message, image } = req.body; 
        
        // สร้าง parts สำหรับ "คำถามล่าสุด" ของผู้ใช้ (ข้อความ + รูป)
        const userParts = [];

        if (message) {
            userParts.push({ text: message });
        }

        if (image) {
            userParts.push({
                inline_data: {
                    mime_type: image.mimeType,
                    data: image.data
                }
            });
        }

        // ถ้าไม่มีข้อมูลอะไรเลย
        if (userParts.length === 0) {
            return res.status(400).json({ reply: "กรุณาส่งข้อความหรือรูปภาพ" });
        }
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${SELECTED_MODEL}:generateContent?key=${GOOGLE_API_KEY}`;
        
        // ต่อประวัติสนทนากับข้อความใหม่ของผู้ใช้
        const updatedHistory = [
            ...conversationHistory,
            { role: "user", parts: userParts }
        ];

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: updatedHistory,
                systemInstruction: {
                    role: "system",
                    parts: [{ text: BOT_PERSONA }]
                }
            })
        });

        const data = await response.json();

        // จัดการกรณี Gemini overload / rate limit โดยเฉพาะ
        if (!response.ok || data.error) {
            const status = response.status;
            const msg = (data && data.error && data.error.message) ? data.error.message : "ไม่ทราบสาเหตุ";
            const lowerMsg = String(msg).toLowerCase();

            const isOverload =
                status === 429 ||
                status === 503 ||
                lowerMsg.includes("overloaded") ||
                lowerMsg.includes("resource has been exhausted") ||
                lowerMsg.includes("rate") ||
                lowerMsg.includes("quota");

            if (isOverload) {
                console.warn("Gemini overload/rate limit:", msg);
                return res.status(503).json({
                    reply: "ตอนนี้ Gemini คนใช้เยอะ / ระบบแน่นอยู่ ลองเว้นสักพักแล้วส่งใหม่อีกทีนะเพื่อน"
                });
            }

            console.error("Google API Error:", msg);
            return res.status(status || 400).json({
                reply: "มีปัญหาในการเรียก Gemini: " + msg
            });
        }

        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const candidateContent = data.candidates[0].content;
            const replyText = candidateContent.parts
                .map(p => p.text || "")
                .join("");

            // อัปเดตประวัติสนทนา (ผู้ใช้ + บอท)
            conversationHistory = [
                ...updatedHistory,
                { role: "model", parts: candidateContent.parts }
            ];

            // จำกัดความยาวประวัติ (เก็บล่าสุดประมาณ 10 เทิร์น = 20 content)
            if (conversationHistory.length > 20) {
                conversationHistory = conversationHistory.slice(-20);
            }

            res.json({ reply: replyText });
        } else {
            res.json({ reply: "ไม่พบคำตอบจาก Model กรุณาลองใหม่อีกครั้ง" });
        }

    } catch (error) {
        console.error("Backend Crash Error:", error);
        res.status(500).json({ reply: "ระบบหลังบ้านขัดข้อง กรุณาตรวจสอบ Terminal" });
    }
});

app.listen(port, () => {
    console.log(`🚀 Server ready at http://localhost:${port}`);
    console.log(`📡 Using Model: ${SELECTED_MODEL}`);
});