import React, { useState, useRef, useEffect } from 'react';
import './bot.css';

const IconCamera = (props) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
        <path
            fill="currentColor"
            d="M20 5h-3.2l-1.1-1.6A2 2 0 0 0 13.9 2.5h-3.8a2 2 0 0 0-1.7.9L7.2 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 14H4V7h3.7c.3 0 .6-.2.8-.4l1.4-2.1h4.3l1.4 2.1c.2.3.5.4.8.4H20v12Zm-8-11a5 5 0 1 0 0 10a5 5 0 0 0 0-10Zm0 8a3 3 0 1 1 0-6a3 3 0 0 1 0 6Z"
        />
    </svg>
);

const IconSend = (props) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
        <path
            fill="currentColor"
            d="M2 21l21-9L2 3v7l15 2-15 2v7Z"
        />
    </svg>
);

const INITIAL_BOT_MESSAGE = {
    type: 'bot',
    text: 'ระบบพร้อมใช้งาน... ส่งรูปภาพให้ช่วยดู หรือพิมพ์คุยได้เลยครับ',
    isInitial: true
};

const createConversation = (index) => ({
    id: `conv-${Date.now()}-${index}`,
    title: `บทสนทนา ${index}`,
    messages: [INITIAL_BOT_MESSAGE]
});

const Bot = () => {
    // State สำหรับเก็บหลายบทสนทนา
    const [chatState, setChatState] = useState(() => {
        const firstConv = createConversation(1);
        return {
            conversations: [firstConv],
            activeId: firstConv.id
        };
    });

    const { conversations, activeId } = chatState;
    const activeConversation = conversations.find((c) => c.id === activeId) || conversations[0];
    const messages = activeConversation ? activeConversation.messages : [];
    
    // State สำหรับ Input
    const [inputValue, setInputValue] = useState('');
    const [previewImage, setPreviewImage] = useState(null); // URL สำหรับโชว์
    const [imageData, setImageData] = useState(null); // Data สำหรับส่ง API
    
    // Refs
    const chatBoxRef = useRef(null);
    const fileInputRef = useRef(null);

    // Auto-scroll ลงล่างสุดเสมอ
    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [messages, previewImage]);

    // ฟังก์ชันจัดการเมื่อเลือกไฟล์รูป
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64String = event.target.result;
            setPreviewImage(base64String); // ใช้แสดงผล
            // เก็บข้อมูลไว้ส่ง API (ตัด header data:image/... ออก)
            setImageData({
                mimeType: file.type,
                data: base64String.split(',')[1]
            });
        };
        reader.readAsDataURL(file);
        
        // Reset input file เพื่อให้เลือกรูปเดิมซ้ำได้ถ้าต้องการ
        e.target.value = ''; 
    };

    // ฟังก์ชันลบรูปที่เลือก
    const removeImage = () => {
        setPreviewImage(null);
        setImageData(null);
    };

    // ฟังก์ชันสร้างบทสนทนาใหม่
    const handleNewConversation = () => {
        setChatState((prev) => {
            const nextIndex = prev.conversations.length + 1;
            const newConv = createConversation(nextIndex);
            return {
                conversations: [...prev.conversations, newConv],
                activeId: newConv.id
            };
        });
        setInputValue('');
        removeImage();
    };

    // ฟังก์ชันเลือกบทสนทนาจาก sidebar
    const handleSelectConversation = (id) => {
        setChatState((prev) => ({
            ...prev,
            activeId: id
        }));
        setInputValue('');
        removeImage();
    };

    // ฟังก์ชันส่งข้อความ
    const handleSendMessage = async () => {
        if (!inputValue.trim() && !imageData) return;

        // 1. เพิ่มข้อความฝั่ง User ลงใน Chat ทันที
        const newUserMessage = { 
            type: 'user', 
            text: inputValue, 
            image: previewImage // ถ้ามีรูป ก็แสดงรูปด้วย
        };

        setChatState((prev) => {
            const updatedConversations = prev.conversations.map((conv) =>
                conv.id === prev.activeId
                    ? { ...conv, messages: [...conv.messages, newUserMessage] }
                    : conv
            );
            return { ...prev, conversations: updatedConversations };
        });
        
        // 2. เก็บค่าไว้ส่ง API และเคลียร์ Input ทันที
        const payload = {
            message: inputValue,
            image: imageData
        };
        
        setInputValue('');
        removeImage(); // เคลียร์รูปออกจากช่องพิมพ์

        // 3. ส่งข้อมูลไปหา Server
        try {
            const response = await fetch('http://localhost:3000/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            
            // 4. เพิ่มข้อความตอบกลับจาก Bot ลงในบทสนทนาปัจจุบัน
            const botReply = {
                type: 'bot',
                text: data.reply || 'เกิดข้อผิดพลาดในการรับข้อมูล'
            };

            setChatState((prev) => {
                const updatedConversations = prev.conversations.map((conv) =>
                    conv.id === prev.activeId
                        ? { ...conv, messages: [...conv.messages, botReply] }
                        : conv
                );
                return { ...prev, conversations: updatedConversations };
            });

        } catch (error) {
            console.error("Fetch Error:", error);
            setChatState((prev) => {
                const fallbackMessage = {
                    type: 'bot',
                    text: 'ระบบขัดข้อง: กรุณาตรวจสอบการรัน Server'
                };
                const updatedConversations = prev.conversations.map((conv) =>
                    conv.id === prev.activeId
                        ? { ...conv, messages: [...conv.messages, fallbackMessage] }
                        : conv
                );
                return { ...prev, conversations: updatedConversations };
            });
        }
    };

    // sidebar เปิด-ปิด
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    return (
        <div className="chat-shell">
            {isSidebarOpen && (
                <aside className="chat-sidebar">
                    <div className="chat-sidebar-header">
                        <span>ประวัติสนทนา</span>
                        <button
                            className="sidebar-close-btn"
                            type="button"
                            onClick={() => setIsSidebarOpen(false)}
                            aria-label="ซ่อนประวัติสนทนา"
                        >
                            ×
                        </button>
                    </div>
                    <button
                        className="new-chat-btn"
                        type="button"
                        onClick={handleNewConversation}
                    >
                        + บทสนทนาใหม่
                    </button>
                    <div className="conversation-list">
                        {conversations.map((conv, index) => (
                            <button
                                key={conv.id}
                                type="button"
                                className={`conversation-item ${conv.id === activeId ? 'active' : ''}`}
                                onClick={() => handleSelectConversation(conv.id)}
                            >
                                <span className="conversation-title">{conv.title}</span>
                                <span className="conversation-subtitle">
                                    {conv.messages[0]?.text?.slice(0, 22) || `เริ่มต้น #${index + 1}`}
                                </span>
                            </button>
                        ))}
                    </div>
                </aside>
            )}

            <div className="chat-container">
                <div className="chat-header">
                    <button
                        className="sidebar-toggle-btn"
                        type="button"
                        onClick={() => setIsSidebarOpen((open) => !open)}
                        aria-label={isSidebarOpen ? 'ซ่อนประวัติสนทนา' : 'แสดงประวัติสนทนา'}
                    >
                        ☰
                    </button>
                    <h2>LIONBOT <span className="status-dot"></span></h2>
                </div>
                
                <div className="chat-box" ref={chatBoxRef}>
                    {messages.map((msg, index) => (
                        <div key={index} className={`message-row ${msg.type}-row`}>
                            {/* Avatar */}
                            {msg.type === 'bot' && (
                                 <img src="https://cdn-icons-png.flaticon.com/512/394/394845.png" alt="Bot" className="avatar" />
                            )}
                            {msg.type === 'user' && (
                                 <img src="https://cdn-icons-png.flaticon.com/512/1077/1077114.png" alt="User" className="avatar" />
                            )}

                            <div className={`message-bubble ${msg.type}-bubble`}>
                                {msg.text}
                                {msg.image && <img src={msg.image} alt="uploaded" className="chat-uploaded-image" />}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="chat-input-area">
                    {/* กล่อง Preview รูปภาพที่เด้งขึ้นมา */}
                    {previewImage && (
                        <div className="image-preview-container">
                            <img src={previewImage} alt="Preview" />
                            <button onClick={removeImage} className="remove-img-btn">
                                ×
                            </button>
                        </div>
                    )}
                    
                    {/* ปุ่มอัปโหลดรูป (ซ่อน Input จริงไว้) */}
                    <input 
                        type="file" 
                        id="image-input" 
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleFileChange} 
                        style={{ display: 'none' }} 
                    />
                    
                    {/* ปุ่มกล้องถ่ายรูป */}
                    <button
                        className="icon-btn"
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="อัปโหลดรูปภาพ"
                        title="อัปโหลดรูปภาพ"
                    >
                        <IconCamera className="btn-icon" />
                    </button>

                    {/* ช่องพิมพ์ข้อความ */}
                    <input 
                        type="text" 
                        value={inputValue} 
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="พิมพ์ข้อความ... (Enter เพื่อส่ง)" 
                    />
                    
                    {/* ปุ่มส่งข้อความ */}
                    <button
                        onClick={handleSendMessage}
                        className="send-btn"
                        type="button"
                        aria-label="ส่งข้อความ"
                        title="ส่งข้อความ"
                    >
                        <IconSend className="btn-icon" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Bot;