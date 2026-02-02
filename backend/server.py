from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json

app = Flask(__name__)

# เพิ่ม limit เพื่อให้รับไฟล์รูปภาพขนาดใหญ่ได้ (เทียบเท่า 10MB)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024 
CORS(app)

# --- [CONFIG] ---
# ⚠️ อย่าลืมเปลี่ยน API KEY เป็นของคุณเอง
GOOGLE_API_KEY = "AIzaSyCRATPTSGGr57UWBOVJ9t9QYiGa3Z2RlpI"
SELECTED_MODEL = "gemini-2.5-flash" # เปลี่ยนรุ่นเป็น 1.5-flash เพื่อความชัวร์ (รุ่น 3 อาจยังไม่เปิดให้ทุกคนใช้)

# กำหนดบุคลิกบอท
BOT_PERSONA = """
คุณคือแชตบอทผู้ชายชื่อ "LIONBOT"
- ใช้สรรพนามแทนตัวเองว่า "ผม"
- เรียกผู้ใช้ว่า "คุณ" หรือ "ผู้ใช้" ให้สุภาพ เป็นกลาง
- บุคลิกสุภาพ อธิบายให้เข้าใจง่าย ชัดเจน ไม่หยาบคาย
- สามารถแทรกคำอังกฤษได้บ้าง แต่โดยรวมให้ใช้ภาษาไทยที่อ่านง่าย
- ถ้าคำตอบยาว ให้จัดรูปแบบให้อ่านง่าย เช่น แบ่งย่อหน้า หรือใช้ bullet ตามความเหมาะสม
""".strip()

# เก็บประวัติการสนทนาไว้ในหน่วยความจำของเซิร์ฟเวอร์
conversation_history = []

@app.route('/api/chat', methods=['POST'])
def chat():
    global conversation_history
    
    try:
        body = request.json
        message = body.get('message')
        image = body.get('image')

        # สร้าง parts สำหรับ "คำถามล่าสุด" ของผู้ใช้
        user_parts = []

        if message:
            user_parts.append({"text": message})

        if image:
            user_parts.append({
                "inline_data": {
                    "mime_type": image.get('mimeType'),
                    "data": image.get('data')
                }
            })

        if not user_parts:
            return jsonify({"reply": "กรุณาส่งข้อความหรือรูปภาพ"}), 400

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{SELECTED_MODEL}:generateContent?key={GOOGLE_API_KEY}"

        # ต่อประวัติสนทนากับข้อความใหม่ของผู้ใช้
        updated_history = conversation_history + [
            {"role": "user", "parts": user_parts}
        ]

        payload = {
            "contents": updated_history,
            "systemInstruction": {
                "role": "system",
                "parts": [{"text": BOT_PERSONA}]
            }
        }

        headers = {"Content-Type": "application/json"}
        
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code != 200:
            data = response.json()
            error_msg = data.get('error', {}).get('message', 'ไม่ทราบสาเหตุ')
            print(f"Google API Error: {error_msg}")
            return jsonify({"reply": f"มีปัญหาในการเรียก Gemini: {error_msg}"}), response.status_code

        data = response.json()
        
        if 'candidates' in data and data['candidates'] and 'content' in data['candidates'][0]:
            candidate_content = data['candidates'][0]['content']
            
            reply_text = "".join([p.get('text', '') for p in candidate_content.get('parts', [])])

            # อัปเดตประวัติสนทนา
            conversation_history = updated_history + [
                {"role": "model", "parts": candidate_content['parts']}
            ]

            # --- จุดที่แก้ไขแล้ว ---
            if len(conversation_history) > 20:
                conversation_history = conversation_history[-20:]
            # --------------------

            return jsonify({"reply": reply_text})
        else:
            return jsonify({"reply": "ไม่พบคำตอบจาก Model กรุณาลองใหม่อีกครั้ง"})

    except Exception as e:
        print(f"Backend Crash Error: {e}")
        return jsonify({"reply": "ระบบหลังบ้านขัดข้อง กรุณาตรวจสอบ Terminal"}), 500

if __name__ == '__main__':
    port = 3000
    print(f"🚀 Server ready at http://localhost:{port}")
    app.run(port=port, debug=True)