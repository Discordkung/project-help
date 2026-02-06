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

// แปลงข้อความธรรมดาที่มี * และ ** แบบง่าย ๆ ให้เป็น JSX ใกล้เคียง Gemini
const renderInlineMarkdown = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
        const boldMatch = part.match(/^\*\*(.+)\*\*$/);
        if (boldMatch) {
            return <strong key={`b-${index}`}>{boldMatch[1]}</strong>;
        }
        return <span key={`t-${index}`}>{part}</span>;
    });
};

const renderMessageText = (text) => {
    if (!text) return null;

    const lines = text.split('\n');
    const blocks = [];
    let listBuffer = [];

    const flushList = (key) => {
        if (listBuffer.length === 0) return;
        blocks.push(
            <ul className="msg-list" key={`ul-${key}`}>
                {listBuffer.map((item, i) => (
                    <li key={`li-${key}-${i}`}>{item}</li>
                ))}
            </ul>
        );
        listBuffer = [];
    };

    lines.forEach((raw, idx) => {
        const line = raw.trimEnd();
        const bulletMatch = line.trim().match(/^[-*]\s+(.*)/);

        if (bulletMatch) {
            const content = bulletMatch[1];
            listBuffer.push(renderInlineMarkdown(content));
        } else if (line.trim() === '') {
            flushList(idx);
        } else {
            flushList(idx);
            blocks.push(
                <p className="msg-paragraph" key={`p-${idx}`}>
                    {renderInlineMarkdown(line)}
                </p>
            );
        }
    });

    flushList('last');
    return blocks;
};

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

    // File Handling (รองรับหลายไฟล์)
    const [selectedFiles, setSelectedFiles] = useState([]); // Array ของ { name, type, isImage, previewUrl, base64 }
    
    const chatBoxRef = useRef(null);
    const fileInputRef = useRef(null);

    // Scroll to bottom
    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [messages, isLoading, selectedFiles]);

    // จัดการการเลือกไฟล์ (ได้หลายไฟล์)
    const handleFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        files.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64String = event.target.result;
                const isImage = file.type.startsWith('image/');

                setSelectedFiles((prev) => [
                    ...prev,
                    {
                        fileObj: file,
                        name: file.name,
                        type: file.type,
                        isImage,
                        previewUrl: isImage ? base64String : null,
                        base64: base64String
                    }
                ]);
            };
            reader.readAsDataURL(file);
        });

        e.target.value = '';
    };

    const removeFileAt = (index) => {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const clearAllFiles = () => setSelectedFiles([]);

    // สร้าง Chat ใหม่
    const handleNewConversation = () => {
        setChatState(prev => {
            const newConv = createConversation(prev.conversations.length + 1);
            return { conversations: [...prev.conversations, newConv], activeId: newConv.id };
        });
        setInputValue('');
        clearAllFiles();
    };

    // ส่งข้อความ
    const handleSendMessage = async () => {
        if (!inputValue.trim() && selectedFiles.length === 0) return;

        // 1. สร้าง Message ฝั่ง User
        const newUserMessage = { 
            type: 'user',
            text: inputValue,
            files: selectedFiles // แนบข้อมูลไฟล์หลายไฟล์ไปด้วยเพื่อใช้แสดงผล
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
            files: selectedFiles.map((f) => ({
                mimeType: f.type,
                data: f.base64.split(',')[1] // ตัด header ออก
            }))
        };

        // Reset Input & Show Loading
        setInputValue('');
        clearAllFiles();
        setIsLoading(true);

        // 3. ยิง API
        try {
            const response = await fetch('http://localhost:5000/api/chat', {
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
                                onClick={() => {  setChatState(prev => ({...prev, activeId: conv.id}));  clearAllFiles(); // ใช้ชื่อฟังก์ชันนี้ครับ
}}
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
                                {/* ส่วนแสดงข้อความ (เคารพการขึ้นบรรทัดใหม่) */}
                                <div className="message-text">
                                    {renderMessageText(msg.text)}
                                </div>

                                {/* ส่วนแสดงไฟล์แนบในประวัติแชท (รองรับหลายไฟล์) */}
                                {Array.isArray(msg.files) &&
                                    msg.files.map((f, i) =>
                                        f.isImage ? (
                                            <img
                                                key={`img-${i}`}
                                                src={f.previewUrl || f.base64}
                                                alt="attached"
                                                className="chat-uploaded-image"
                                            />
                                        ) : (
                                            <div className="file-attachment" key={`file-${i}`}>
                                                <div className="file-attachment-icon">
                                                    <IconFileGeneric />
                                                </div>
                                                <div className="file-attachment-info">
                                                    <span className="file-attachment-name">
                                                        {f.name}
                                                    </span>
                                                    <span className="file-attachment-meta">
                                                        {getFileExt(f.type)} Document
                                                    </span>
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
                    {selectedFiles.length > 0 && (
                        <div className="preview-popup">
                            <div className="preview-content">
                                {selectedFiles.map((f, index) => (
                                    <div className="preview-item" key={`pv-${index}`}>
                                        {f.isImage ? (
                                            <img
                                                src={f.previewUrl}
                                                alt="Preview"
                                                className="preview-thumbnail"
                                            />
                                        ) : (
                                            <div className="preview-file-icon">
                                                <div className="preview-file-icon-inner">
                                                    <IconFileGeneric />
                                                </div>
                                                <span className="preview-file-ext">
                                                    {getFileExt(f.type)}
                                                </span>
                                            </div>
                                        )}
                                        <div className="preview-info">
                                            <span className="file-name">{f.name}</span>
                                            <span className="file-type">
                                                {f.isImage ? 'Image' : 'Document'}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            className="preview-remove-btn"
                                            onClick={() => removeFileAt(index)}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                className="preview-clear-all-btn"
                                onClick={clearAllFiles}
                            >
                                ลบทั้งหมด
                            </button>
                        </div>
                    )}

                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        style={{display:'none'}}
                        multiple
                        // รับไฟล์ได้หลายประเภท รวมถึง Word / Excel
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

                    <button className="send-btn" onClick={handleSendMessage} disabled={isLoading || (!inputValue && selectedFiles.length === 0)}>
                        <IconSend />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Bot;