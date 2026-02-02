// ตัวแปรเก็บข้อมูลรูปภาพ (Global)
let selectedImageBase64 = null;
let selectedImageMimeType = null;

// ป้องกันบัค "รูปค้าง" จากการอ่านไฟล์แบบ async:
// ถ้า user ส่ง/ลบรูปก่อน FileReader อ่านเสร็จ onload จะมาทีหลังและโชว์ preview กลับมา
let activeFileReader = null;
let fileReadNonce = 0;

// 1. Event Listener เมื่อมีการเลือกไฟล์รูป
document.getElementById('image-input').addEventListener('change', function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    // ยกเลิกการอ่านไฟล์ก่อนหน้า (ถ้ามี)
    try {
        if (activeFileReader && activeFileReader.readyState === FileReader.LOADING) {
            activeFileReader.abort();
        }
    } catch (_) {
        // ignore
    }

    const thisReadNonce = ++fileReadNonce;
    const reader = new FileReader();
    activeFileReader = reader;

    reader.onload = function (e) {
        // ถ้ามีการเลือกไฟล์ใหม่/ลบรูป/ส่งข้อความไปแล้ว ให้ทิ้งผลอ่านเก่า
        if (thisReadNonce !== fileReadNonce) return;

        const base64String = e.target && e.target.result;
        if (typeof base64String !== 'string') return;

        selectedImageMimeType = file.type;
        selectedImageBase64 = base64String.split(',')[1];

        // แสดงรูป Preview
        const previewContainer = document.getElementById('image-preview-container');
        const previewImage = document.getElementById('image-preview');
        previewImage.src = base64String;
        previewContainer.style.display = 'flex';

        // เปลี่ยนสีไอคอนให้รู้ว่าเลือกรูปแล้ว
        const imageIcon = document.querySelector('.fa-image');
        if (imageIcon) imageIcon.style.color = '#00ffcc';
    };

    reader.readAsDataURL(file);
});

// 2. ฟังก์ชันลบรูป (กดปุ่มกากบาท หรือเคลียร์หลังส่ง)
function removeImage() {
    // invalidate pending FileReader onload
    fileReadNonce++;
    try {
        if (activeFileReader && activeFileReader.readyState === FileReader.LOADING) {
            activeFileReader.abort();
        }
    } catch (_) {
        // ignore
    } finally {
        activeFileReader = null;
    }

    selectedImageBase64 = null;
    selectedImageMimeType = null;

    const inputEl = document.getElementById('image-input');
    inputEl.value = ""; // รีเซ็ต input file

    const previewContainer = document.getElementById('image-preview-container');
    previewContainer.style.display = 'none'; // ซ่อน Preview

    // เคลียร์ src ด้วย กันกรณีบาง layout/บางเบราว์เซอร์เห็นเหมือนรูปยังค้าง
    const previewImage = document.getElementById('image-preview');
    previewImage.src = "";

    const imageIcon = document.querySelector('.fa-image');
    if (imageIcon) imageIcon.style.color = '';
}

// 3. ฟังก์ชันช่วยแสดงข้อความใน Chat Box
function appendMessage(sender, htmlContent) {
    const chatBox = document.getElementById('chat-box');
    const rowClass = sender === 'user' ? 'user-row' : 'bot-row';
    const bubbleClass = sender === 'user' ? 'user-bubble' : 'bot-bubble';
    const avatar = sender === 'bot'
        ? '<img src="https://cdn-icons-png.flaticon.com/512/394/394845.png" class="avatar">'
        : '';

    const html = `
        <div class="message-row ${rowClass}">
            ${avatar}
            <div class="message-bubble ${bubbleClass}">${htmlContent}</div>
        </div>`;

    chatBox.insertAdjacentHTML('beforeend', html);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// 4. ฟังก์ชันส่งข้อความ
async function sendMessage() {
    const userInput = document.getElementById('user-input');
    const message = userInput.value.trim();

    // ถ้าไม่มีทั้งข้อความและรูป ให้ไม่ทำอะไร
    if (message === "" && !selectedImageBase64) return;

    // --- ส่วนแสดงผลฝั่ง User ---
    let displayHtml = message;
    if (selectedImageBase64) {
        displayHtml += `<br><img src="data:${selectedImageMimeType};base64,${selectedImageBase64}" style="max-width: 200px; border-radius: 10px; margin-top: 5px;">`;
    }
    appendMessage('user', displayHtml);

    const currentMessage = message;
    const currentImage = selectedImageBase64
        ? { mimeType: selectedImageMimeType, data: selectedImageBase64 }
        : null;

    // เคลียร์ช่องพิมพ์ทันที
    userInput.value = "";

    try {
        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: currentMessage,
                image: currentImage
            })
        });

        const data = await response.json();

        if (data.reply) {
            appendMessage('bot', data.reply);
        } else {
            appendMessage('bot', 'เกิดข้อผิดพลาดในการรับข้อมูล');
        }
    } catch (error) {
        console.error("Fetch Error:", error);
        appendMessage('bot', 'ระบบขัดข้อง: กรุณาตรวจสอบการรัน Server');
    } finally {
        // ไม่ว่าจะส่งผ่านหรือไม่ผ่าน ให้เคลียร์รูปออกจาก Preview เสมอ
        removeImage();
    }
}

// 5. รองรับการกด Enter
document.getElementById('user-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
    }
});