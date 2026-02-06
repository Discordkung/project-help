from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json

app = Flask(__name__)

# ตั้งค่าให้รับไฟล์ขนาดใหญ่ได้ (เช่น 10MB)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024 
CORS(app)

# --- [CONFIG] ---
# ⚠️ ใส่ API KEY ของคุณที่นี่
GOOGLE_API_KEY = "AIzaSyBvBp3mvo_G07M_Yh4ZW7RKjPpPwu-N688" 
# แนะนำรุ่น 2.0-flash หรือ 1.5-flash เพื่อความเร็วและการรองรับไฟล์ที่ดี
SELECTED_MODEL = "gemini-2.5-flash" 

BOT_PERSONA = """
คุณคือแชตบอทผู้ชายชื่อ "LIONBOT"
- ใช้สรรพนามแทนตัวเองว่า "ผม"
- เรียกผู้ใช้ว่า "คุณ" หรือ "ผู้ใช้" ให้สุภาพ เป็นกลาง
- บุคลิกสุภาพ อธิบายให้เข้าใจง่าย ชัดเจน ไม่หยาบคาย
""".strip()

conversation_history = []

# ฟังก์ชันแยกแยะประเภทไฟล์จาก Mime Type
def get_file_description(mime_type):
    if not mime_type:
        return ""
    
    if "image" in mime_type:
        return "รูปภาพ"
    elif "pdf" in mime_type:
        return "เอกสาร PDF"
    elif "word" in mime_type or "officedocument" in mime_type:
        return "เอกสาร Word"
    elif "sheet" in mime_type or "excel" in mime_type:
        return "เอกสาร Excel"
    elif "text" in mime_type:
        return "ไฟล์ข้อความ"
    else:
        return f"ไฟล์ชนิด {mime_type}"

@app.route('/api/chat', methods=['POST'])
def chat():
    global conversation_history
    
    try:
        body = request.json
        message = body.get('message')
        # รับข้อมูลไฟล์ (รองรับทั้ง key 'image' และ 'file')
        file_data = body.get('image') or body.get('file') 

        user_parts = []

        # 1. จัดการไฟล์แนบ (ถ้ามี)
        if file_data:
            mime_type = file_data.get('mimeType', '')
            base64_data = file_data.get('data', '')
            
            # แปลง Mime Type เป็นชื่อที่เข้าใจง่าย
            file_desc = get_file_description(mime_type)

            # [ส่วนสำคัญ] แทรกข้อความระบบบอกบอทว่าไฟล์นี้คืออะไร
            if file_desc:
                user_parts.append({
                    "text": f"\n[ระบบ: ผู้ใช้ได้แนบ '{file_desc}' มาด้วย]\n"
                })

            # ส่งข้อมูลไฟล์จริง
            user_parts.append({
                "inline_data": {
                    "mime_type": mime_type,
                    "data": base64_data
                }
            })

        # 2. ใส่ข้อความที่ผู้ใช้พิมพ์
        if message:
            user_parts.append({"text": message})

        # ถ้าไม่มีทั้งข้อความและไฟล์ ให้แจ้งเตือน
        if not user_parts:
            return jsonify({"reply": "กรุณาส่งข้อความหรือไฟล์แนบครับ"}), 400

        # เตรียม URL และ Payload
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{SELECTED_MODEL}:generateContent?key={GOOGLE_API_KEY}"

        # อัปเดตประวัติการคุย (ฝั่ง User)
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
        
        # --- จังหวะนี้คือตอนที่ Python กำลัง "คิด" ---
        # --- (Frontend จะแสดง Animation ... ค้างไว้ในช่วงนี้) ---
        response = requests.post(url, headers=headers, json=payload)
        
        # ตรวจสอบ Error จาก Google
        if response.status_code != 200:
            data = response.json()
            error_msg = data.get('error', {}).get('message', 'ไม่ทราบสาเหตุ')
            print(f"Google API Error: {error_msg}")
            
            if "INVALID_ARGUMENT" in error_msg:
                return jsonify({"reply": "ขออภัยครับ ไฟล์ประเภทนี้ระบบอาจยังไม่รองรับเต็มรูปแบบ (แนะนำให้ใช้ PDF หรือ รูปภาพ ครับ)"}), 200
                
            return jsonify({"reply": f"ระบบขัดข้อง: {error_msg}"}), response.status_code

        # ดึงคำตอบจาก JSON
        data = response.json()
        
        if 'candidates' in data and data['candidates'] and 'content' in data['candidates'][0]:
            candidate_content = data['candidates'][0]['content']
            reply_text = "".join([p.get('text', '') for p in candidate_content.get('parts', [])])

            # อัปเดตประวัติการคุย (ฝั่ง Model)
            conversation_history = updated_history + [
                {"role": "model", "parts": candidate_content['parts']}
            ]

            # จำกัด History ไม่ให้เกิน 20 ข้อความล่าสุด
            if len(conversation_history) > 20:
                conversation_history = conversation_history[-20:]

            return jsonify({"reply": reply_text})
        else:
            return jsonify({"reply": "บอทไม่ตอบสนอง กรุณาลองใหม่ครับ"})

    except Exception as e:
        print(f"Server Error: {e}")
        return jsonify({"reply": "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์"}), 500

if __name__ == '__main__':
    port = 3000
    print(f"🚀 LIONBOT Server ready at http://localhost:{port}")
    app.run(port=port, debug=True)