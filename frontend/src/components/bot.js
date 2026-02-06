import React, { useState, useRef, useEffect } from 'react';
import './bot.css';

// SVG Icons (ใช้ SVG ตรงๆ เพื่อไม่ต้องลง Library เพิ่ม)
const IconAttachment = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
);
const IconSend = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
);
const IconFileGeneric = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
);

const INITIAL_BOT_MESSAGE = {
    type: 'bot',
    text: 'สวัสดีครับ ผม LIONBOT 🦁\nมีอะไรให้ช่วย หรือต้องการให้วิเคราะห์เอกสาร/รูปภาพ ส่งมาได้เลยครับ',
    isInitial: true
};

const createConversation = (index) => ({
    id: `conv-${Date.now()}-${index}`,
    title: `การสนทนาที่ ${index}`,
    messages: [INITIAL_BOT_MESSAGE]
});

const Bot = () => {
    // Chat State
    const [chatState, setChatState] = useState(() => {
        const firstConv = createConversation(1);
        return { conversations: [firstConv], activeId: firstConv.id };
    });

    const { conversations, activeId } = chatState;
    const activeConversation = conversations.find(c => c.id === activeId) || conversations[0];
    const messages = activeConversation ? activeConversation.messages : [];

    // UI States
    const [inputValue, setInputValue] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isLoading, setIsLoading] = useState(false); // สถานะกำลังพิมพ์...

    // File Handling
    const [selectedFile, setSelectedFile] = useState(null); // เก็บ Object ไฟล์ { name, type, data, previewUrl }
    
    const chatBoxRef = useRef(null);
    const fileInputRef = useRef(null);

    // Scroll to bottom
    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [messages, isLoading, selectedFile]);

    // จัดการการเลือกไฟล์
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64String = event.target.result;
            const isImage = file.type.startsWith('image/');
            
            setSelectedFile({
                fileObj: file,
                name: file.name,
                type: file.type,
                isImage: isImage,
                previewUrl: isImage ? base64String : null, // ถ้าไม่ใช่รูป ไม่ต้องสร้าง URL Preview ใหญ่
                base64: base64String // เก็บไว้ส่ง API
            });
        };
        reader.readAsDataURL(file); // อ่านเป็น Base64 ทั้งรูปและเอกสาร เพื่อส่งให้ Gemini
        e.target.value = '';
    };

    const removeFile = () => setSelectedFile(null);

    // สร้าง Chat ใหม่
    const handleNewConversation = () => {
        setChatState(prev => {
            const newConv = createConversation(prev.conversations.length + 1);
            return { conversations: [...prev.conversations, newConv], activeId: newConv.id };
        });
        setInputValue('');
        removeFile();
    };

    // ส่งข้อความ
    const handleSendMessage = async () => {
        if (!inputValue.trim() && !selectedFile) return;

        // 1. สร้าง Message ฝั่ง User
        const newUserMessage = { 
            type: 'user', 
            text: inputValue, 
            file: selectedFile // แนบข้อมูลไฟล์ไปด้วยเพื่อใช้แสดงผล
        };

        setChatState(prev => {
            const updated = prev.conversations.map(c => 
                c.id === prev.activeId ? { ...c, messages: [...c.messages, newUserMessage] } : c
            );
            return { ...prev, conversations: updated };
        });

        // 2. เตรียม Payload
        const payload = {
            message: inputValue,
            file: selectedFile ? {
                mimeType: selectedFile.type,
                data: selectedFile.base64.split(',')[1] // ตัด header ออก
            } : null
        };

        // Reset Input & Show Loading
        setInputValue('');
        removeFile();
        setIsLoading(true);

        // 3. ยิง API
        try {
            const response = await fetch('http://localhost:3000/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            
            const botReply = {
                type: 'bot',
                text: data.reply || 'ไม่ได้รับคำตอบจากระบบ'
            };

            setChatState(prev => {
                const updated = prev.conversations.map(c => 
                    c.id === prev.activeId ? { ...c, messages: [...c.messages, botReply] } : c
                );
                return { ...prev, conversations: updated };
            });

        } catch (error) {
            console.error(error);
            const errorMsg = { type: 'bot', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ Server' };
            setChatState(prev => {
                const updated = prev.conversations.map(c => 
                    c.id === prev.activeId ? { ...c, messages: [...c.messages, errorMsg] } : c
                );
                return { ...prev, conversations: updated };
            });
        } finally {
            setIsLoading(false); // ปิด Animation
        }
    };

    // Helper: ดึงนามสกุลไฟล์
    const getFileExt = (mimeType) => {
        if (!mimeType) return 'FILE';
        if (mimeType.includes('pdf')) return 'PDF';
        if (mimeType.includes('word') || mimeType.includes('officedocument')) return 'DOC';
        if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'XLS';
        return mimeType.split('/')[1]?.toUpperCase().substring(0,4) || 'FILE';
    };

    return (
        <div className="chat-shell">
            {isSidebarOpen && (
                <aside className="chat-sidebar">
                    <div className="chat-sidebar-header">
                        <span>ประวัติการสนทนา</span>
                        <button className="sidebar-toggle-btn" style={{position:'static', color:'#333', background:'transparent'}} onClick={() => setIsSidebarOpen(false)}>×</button>
                    </div>
                    <button className="new-chat-btn" onClick={handleNewConversation}>+ สร้างบทสนทนาใหม่</button>
                    <div className="conversation-list">
                        {conversations.map((conv) => (
                            <button
                                key={conv.id}
                                className={`conversation-item ${conv.id === activeId ? 'active' : ''}`}
                                onClick={() => { setChatState(prev => ({...prev, activeId: conv.id})); removeFile(); }}
                            >
                                <span className="conversation-title">{conv.title}</span>
                                <span className="conversation-subtitle">{conv.messages[conv.messages.length-1]?.text?.slice(0,25) || '...'}</span>
                            </button>
                        ))}
                    </div>
                </aside>
            )}

            <div className="chat-container">
                <div className="chat-header">
                    {!isSidebarOpen && <button className="sidebar-toggle-btn" onClick={() => setIsSidebarOpen(true)}>☰</button>}
                    <h2>LIONBOT <span className="status-dot"></span></h2>
                </div>

                <div className="chat-box" ref={chatBoxRef}>
                    {messages.map((msg, index) => (
                        <div key={index} className={`message-row ${msg.type}-row`}>
                            {msg.type === 'bot' && (
                                <img src="https://cdn-icons-png.flaticon.com/512/4712/4712027.png" alt="Bot" className="avatar" />
                            )}
                            
                            <div className={`message-bubble ${msg.type}-bubble`}>
                                {/* ส่วนแสดงข้อความ */}
                                <div>{msg.text}</div>

                                {/* ส่วนแสดงไฟล์แนบในประวัติแชท */}
                                {msg.file && (
                                    msg.file.isImage ? (
                                        <img src={msg.file.previewUrl || msg.file.base64} alt="attached" className="chat-uploaded-image" />
                                    ) : (
                                        <div className="file-attachment">
                                            <div style={{background: 'rgba(0,0,0,0.1)', padding:'8px', borderRadius:'4px'}}>
                                                <IconFileGeneric />
                                            </div>
                                            <div style={{display:'flex', flexDirection:'column'}}>
                                                <span style={{fontWeight:'600', fontSize:'0.85rem'}}>{msg.file.name}</span>
                                                <span style={{fontSize:'0.7rem', opacity:0.8}}>{getFileExt(msg.file.type)} Document</span>
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Animation กำลังพิมพ์... */}
                    {isLoading && (
                        <div className="message-row bot-row">
                             <img src="https://cdn-icons-png.flaticon.com/512/4712/4712027.png" alt="Bot" className="avatar" />
                             <div className="typing-indicator">
                                 <div className="typing-dot"></div>
                                 <div className="typing-dot"></div>
                                 <div className="typing-dot"></div>
                             </div>
                        </div>
                    )}
                </div>

                {/* ส่วน Input Area */}
                <div className="chat-input-area">
                    {/* File Preview Popup (เด้งขึ้นมาเมื่อเลือกไฟล์) */}
                    {selectedFile && (
                        <div className="preview-popup">
                            <div className="preview-content">
                                {selectedFile.isImage ? (
                                    <img src={selectedFile.previewUrl} alt="Preview" className="preview-thumbnail" />
                                ) : (
                                    <div className="preview-file-icon">
                                        {getFileExt(selectedFile.type)}
                                    </div>
                                )}
                                <div className="preview-info">
                                    <span className="file-name">{selectedFile.name}</span>
                                    <span className="file-type">{selectedFile.isImage ? 'Image' : 'Document'}</span>
                                </div>
                            </div>
                            <button onClick={removeFile} style={{border:'none', background:'transparent', color:'#ff1744', cursor:'pointer', fontSize:'18px'}}>×</button>
                        </div>
                    )}

                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        style={{display:'none'}}
                        // รับไฟล์ได้หลายประเภท
                        accept="image/*, application/pdf, .doc, .docx, .xls, .xlsx, .txt"
                    />
                    
                    <button className="icon-btn" onClick={() => fileInputRef.current?.click()} title="แนบไฟล์">
                        <IconAttachment />
                    </button>

                    <input 
                        type="text" 
                        value={inputValue} 
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="พิมพ์ข้อความ... หรือแนบไฟล์เอกสาร/รูปภาพ"
                        disabled={isLoading}
                    />

                    <button className="send-btn" onClick={handleSendMessage} disabled={isLoading || (!inputValue && !selectedFile)}>
                        <IconSend />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Bot;