import React, { useState, useRef, useEffect } from 'react';
import './bot.css';

// --- นำเข้ารูปภาพสิงโต ---
import botLogo from './lion-avatar.png'; 

// --- SVG Icons (เพิ่มชุดไอคอนใหม่) ---
const IconAttachment = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
);
const IconSend = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
);

// ไอคอน Word (ตัว W)
const IconWord = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <line x1="10" y1="9" x2="8" y2="9"></line>
    </svg>
);

// ไอคอน Excel (ตาราง)
const IconExcel = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <rect x="8" y="13" width="8" height="4"></rect>
        <line x1="8" y1="13" x2="16" y2="17"></line>
        <line x1="8" y1="17" x2="16" y2="13"></line>
    </svg>
);

// ไอคอน PDF (กระดาษมีพับ)
const IconPDF = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <path d="M12 18v-6h2.5c.8 0 1.5.7 1.5 1.5S15.3 15 14.5 15H12"></path>
    </svg>
);

// ไอคอนไฟล์ทั่วไป
const IconFileGeneric = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
);

// ฟังก์ชันเลือกไอคอนและสีตามชนิดไฟล์
const getFileIconProps = (mimeType) => {
    if (!mimeType) return { icon: <IconFileGeneric />, color: '#6b7280', label: 'FILE' };

    // Excel (สีเขียว)
    if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
        return { icon: <IconExcel />, color: '#107c41', label: 'XLS' }; 
    }
    // Word (สีฟ้า)
    if (mimeType.includes('word') || mimeType.includes('officedocument')) {
        return { icon: <IconWord />, color: '#2b579a', label: 'DOC' };
    }
    // PDF (สีแดง)
    if (mimeType.includes('pdf')) {
        return { icon: <IconPDF />, color: '#e11d48', label: 'PDF' };
    }
    // Text/Other (สีเทา)
    return { icon: <IconFileGeneric />, color: '#6b7280', label: mimeType.split('/')[1]?.toUpperCase().substring(0,4) || 'FILE' };
};

// แปลงข้อความธรรมดาที่มี * และ **
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
    const [isLoading, setIsLoading] = useState(false);

    // File Handling
    const [selectedFiles, setSelectedFiles] = useState([]);
    
    const chatBoxRef = useRef(null);
    const fileInputRef = useRef(null);

    // Scroll to bottom
    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [messages, isLoading, selectedFiles]);

    // จัดการการเลือกไฟล์
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

        const newUserMessage = { 
            type: 'user',
            text: inputValue,
            files: selectedFiles 
        };

        setChatState(prev => {
            const updated = prev.conversations.map(c => 
                c.id === prev.activeId ? { ...c, messages: [...c.messages, newUserMessage] } : c
            );
            return { ...prev, conversations: updated };
        });

        const payload = {
            message: inputValue,
            files: selectedFiles.map((f) => ({
                mimeType: f.type,
                data: f.base64.split(',')[1]
            }))
        };

        setInputValue('');
        clearAllFiles();
        setIsLoading(true);

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
            setIsLoading(false);
        }
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
                                onClick={() => { setChatState(prev => ({...prev, activeId: conv.id})); clearAllFiles(); }}
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
                                <img src={botLogo} alt="LIONBOT" className="avatar" />
                            )}
                            
                            <div className={`message-bubble ${msg.type}-bubble`}>
                                <div className="message-text">
                                    {renderMessageText(msg.text)}
                                </div>

                                {Array.isArray(msg.files) &&
                                    msg.files.map((f, i) => {
                                        if (f.isImage) {
                                            return (
                                                <img
                                                    key={`img-${i}`}
                                                    src={f.previewUrl || f.base64}
                                                    alt="attached"
                                                    className="chat-uploaded-image"
                                                />
                                            );
                                        } else {
                                            // เรียกใช้ฟังก์ชันเลือกไอคอนและสี
                                            const { icon, color, label } = getFileIconProps(f.type);
                                            return (
                                                <div className="file-attachment" key={`file-${i}`}>
                                                    <div className="file-attachment-icon" style={{ backgroundColor: color }}>
                                                        {icon}
                                                    </div>
                                                    <div className="file-attachment-info">
                                                        <span className="file-attachment-name">
                                                            {f.name}
                                                        </span>
                                                        <span className="file-attachment-meta">
                                                            {label} Document
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        }
                                    })}
                            </div>
                        </div>
                    ))}

                    {/* Animation กำลังพิมพ์... */}
                    {isLoading && (
                        <div className="message-row bot-row">
                             <img src={botLogo} alt="LIONBOT" className="avatar" />
                             <div className="typing-indicator">
                                 <div className="typing-dot"></div>
                                 <div className="typing-dot"></div>
                                 <div className="typing-dot"></div>
                             </div>
                        </div>
                    )}
                </div>

                <div className="chat-input-area">
                    {/* File Preview Popup */}
                    {selectedFiles.length > 0 && (
                        <div className="preview-popup">
                            <div className="preview-content">
                                {selectedFiles.map((f, index) => {
                                    const { icon, color, label } = getFileIconProps(f.type);
                                    return (
                                        <div className="preview-item" key={`pv-${index}`}>
                                            {f.isImage ? (
                                                <img
                                                    src={f.previewUrl}
                                                    alt="Preview"
                                                    className="preview-thumbnail"
                                                />
                                            ) : (
                                                <div className="preview-file-icon">
                                                    <div className="preview-file-icon-inner" style={{ backgroundColor: color }}>
                                                        {icon}
                                                    </div>
                                                    <span className="preview-file-ext">
                                                        {label}
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
                                    );
                                })}
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