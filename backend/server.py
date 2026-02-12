from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import os
import base64
import io

# --- Library สำหรับอ่านไฟล์ Word/Excel ---
from docx import Document
import pandas as pd

app = Flask(__name__)

# Config การรับไฟล์
app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024  # 20MB
CORS(app)

# --- [CONFIG] ---
GOOGLE_API_KEY = "" # เช็ค Key ว่าถูกต้อง
SELECTED_MODEL = "gemini-2.5-flash"  # แก้เป็นรุ่นที่มีจริง (หรือใช้ gemini-1.5-flash)

BOT_PERSONA = """
คุณคือ "LIONBOT" ผู้ช่วยอัจฉริยะ
- บุคลิก: สุภาพ, เป็นมืออาชีพ, กระตือรือร้น
- ความสามารถพิเศษ: สามารถอ่านเอกสาร PDF, Word, Excel และรูปภาพที่แนบมาได้
- คำแนะนำ:
  1. หากเป็น Excel ให้วิเคราะห์ข้อมูลตัวเลข สรุปแนวโน้ม หรือตอบคำถามจากตาราง
  2. หากเป็น Word ให้สรุปสาระสำคัญ หรือดึงข้อมูลตามที่ถาม
  3. ตอบคำถามอย่างแม่นยำและกระชับ
""".strip()

conversation_history = []

def extract_text_from_file(mime_type, base64_data):
    """ฟังก์ชันแกะ Text ออกจาก Word และ Excel"""
    try:
        file_bytes = base64.b64decode(base64_data)
        file_stream = io.BytesIO(file_bytes)

        # 1. กรณี Excel
        if "sheet" in mime_type or "excel" in mime_type:
            try:
                df = pd.read_excel(file_stream)
                text_data = df.to_markdown(index=False)
                return f"--- ข้อมูลจากไฟล์ Excel ---\n{text_data}\n------------------------------"
            except Exception as e:
                return f"[Error อ่าน Excel: {str(e)}]"

        # 2. กรณี Word
        elif "word" in mime_type or "officedocument" in mime_type:
            try:
                doc = Document(file_stream)
                full_text = [para.text for para in doc.paragraphs]
                return f"--- ข้อมูลจากไฟล์ Word ---\n{'\n'.join(full_text)}\n-----------------------------"
            except Exception as e:
                return f"[Error อ่าน Word: {str(e)}]"
        
        return None
    except Exception as e:
        print(f"Extraction Error: {e}")
        return None

@app.route('/api/chat', methods=['POST'])
def chat():
    global conversation_history
    
    try:
        body = request.json
        message = body.get('message', '')
        # รับค่า 'files' ที่เป็น Array (ตามที่ bot.js ส่งมา)
        files_list = body.get('files', []) 
        
        # กรณี bot.js เก่าส่งมาแบบ 'file' เดี่ยว (กันพลาด)
        if not files_list and body.get('file'):
            files_list = [body.get('file')]

        user_parts = []

        # 1. จัดการไฟล์แนบ
        for f in files_list:
            mime_type = f.get('mimeType', '').lower()
            base64_data = f.get('data', '')

            # แยกแยะประเภทไฟล์
            is_image_or_pdf = "image" in mime_type or "pdf" in mime_type

            if is_image_or_pdf:
                # ส่งรูป/PDF เข้าไปตรงๆ
                user_parts.append({
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": base64_data
                    }
                })
                print(f"Attached Image/PDF: {mime_type}")
            else:
                # Word/Excel: แกะข้อความก่อน
                extracted_text = extract_text_from_file(mime_type, base64_data)
                if extracted_text:
                    user_parts.append({"text": f"\n\n{extracted_text}\n\n"})
                    print(f"Extracted Text from: {mime_type}")

        # 2. ใส่ข้อความ user
        if message:
            user_parts.append({"text": message})

        if not user_parts:
            return jsonify({"reply": "กรุณาส่งข้อความหรือไฟล์แนบครับ"}), 400

        # เตรียม API Call
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{SELECTED_MODEL}:generateContent?key={GOOGLE_API_KEY}"
        
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
            print(f"Google API Error: {response.text}") # ดู Error จริงใน Terminal
            return jsonify({"reply": f"ระบบขัดข้อง: {response.text}"}), 500

        data = response.json()
        
        if 'candidates' in data and data['candidates']:
            content = data['candidates'][0]['content']
            reply_text = "".join([p.get('text', '') for p in content.get('parts', [])])

            conversation_history = updated_history + [{"role": "model", "parts": content['parts']}]
            
            if len(conversation_history) > 20:
                conversation_history = conversation_history[-20:]

            return jsonify({"reply": reply_text})
        else:
            return jsonify({"reply": "ระบบไม่ตอบสนอง (No candidates returned)"})

    except Exception as e:
        print(f"Server Exception: {e}")
        return jsonify({"reply": f"เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์: {str(e)}"}), 500

if __name__ == '__main__':
    print("🚀 LIONBOT Server is running on port 5000...")
    app.run(port=5000, debug=True)