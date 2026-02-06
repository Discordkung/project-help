from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import os

app = Flask(__name__)

# Config การรับไฟล์
app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024  # เพิ่มเป็น 20MB
CORS(app)

# --- [CONFIG] ---
GOOGLE_API_KEY = "AIzaSyBvBp3mvo_G07M_Yh4ZW7RKjPpPwu-N688"
# แนะนำใช้ 'gemini-1.5-flash' หรือ 'gemini-2.0-flash-exp' (ถ้ามีสิทธิ์) เพื่อรองรับ PDF/Docs ได้ดี
SELECTED_MODEL = "gemini-1.5-flash" 

BOT_PERSONA = """
คุณคือ "LIONBOT" ผู้ช่วยอัจฉริยะ
- บุคลิก: สุภาพ, เป็นมืออาชีพ, กระตือรือร้น
- ความสามารถพิเศษ: สามารถอ่านเอกสาร PDF, Word, Excel และรูปภาพที่แนบมาได้
- คำแนะนำ: หากผู้ใช้แนบเอกสาร ให้สรุปสาระสำคัญ หรือตอบคำถามจากเอกสารนั้นๆ อย่างแม่นยำ
""".strip()

conversation_history = []

@app.route('/api/chat', methods=['POST'])
def chat():
    global conversation_history
    
    try:
        body = request.json
        message = body.get('message', '')
        file_data = body.get('file') # เปลี่ยนรับ key เป็น 'file' เพื่อสื่อความหมายรวม

        user_parts = []

        # 1. จัดการไฟล์แนบ (PDF, Images, etc.)
        if file_data:
            mime_type = file_data.get('mimeType', '')
            base64_data = file_data.get('data', '')

            # Mapping ชื่อไฟล์ให้ AI เข้าใจ context
            file_type_label = "ไฟล์แนบ"
            if "pdf" in mime_type: file_type_label = "เอกสาร PDF"
            elif "image" in mime_type: file_type_label = "รูปภาพ"
            elif "csv" in mime_type or "excel" in mime_type or "spreadsheet" in mime_type: file_type_label = "ตารางข้อมูล (Excel/CSV)"
            
            # แจ้ง AI ว่ามีไฟล์
            user_parts.append({
                "text": f"\n[ระบบ: ผู้ใช้ได้แนบ {file_type_label} มาด้วย โปรดวิเคราะห์ข้อมูลในไฟล์นี้]\n"
            })

            # ส่ง Data
            user_parts.append({
                "inline_data": {
                    "mime_type": mime_type,
                    "data": base64_data
                }
            })

        # 2. ใส่ข้อความ
        if message:
            user_parts.append({"text": message})

        if not user_parts:
            return jsonify({"reply": "กรุณาส่งข้อความหรือไฟล์แนบครับ"}), 400

        # เตรียม API Call
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{SELECTED_MODEL}:generateContent?key={GOOGLE_API_KEY}"
        
        # เพิ่มประวัติ User ลง Memory
        updated_history = conversation_history + [{"role": "user", "parts": user_parts}]

        payload = {
            "contents": updated_history,
            "systemInstruction": {
                "role": "system",
                "parts": [{"text": BOT_PERSONA}]
            }
        }

        headers = {"Content-Type": "application/json"}
        
        # ส่ง Request
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code != 200:
            print(f"Error: {response.text}")
            return jsonify({"reply": "ขออภัย ระบบไม่สามารถประมวลผลไฟล์หรือข้อความนี้ได้ในขณะนี้"}), 500

        data = response.json()
        
        if 'candidates' in data and data['candidates']:
            content = data['candidates'][0]['content']
            reply_text = "".join([p.get('text', '') for p in content.get('parts', [])])

            # เพิ่มคำตอบ Bot ลง Memory
            conversation_history = updated_history + [{"role": "model", "parts": content['parts']}]
            
            # Keep history short (prevent token overflow)
            if len(conversation_history) > 15:
                conversation_history = conversation_history[-15:]

            return jsonify({"reply": reply_text})
        else:
            return jsonify({"reply": "ระบบไม่ตอบสนอง (No candidates returned)"})

    except Exception as e:
        print(f"Server Exception: {e}")
        return jsonify({"reply": "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์"}), 500

if __name__ == '__main__':
    print("🚀 LIONBOT Server is running on port 3000...")
    app.run(port=3000, debug=True)