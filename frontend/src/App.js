import React from 'react';
import './App.css'; // สไตล์หลักของแอป
import Bot from './components/bot'; // นำเข้า Bot component

function App() {
  return (
    <div className="App">
      <main>
        {/* เรียกใช้งาน Bot ตรงนี้ */}
        <Bot />
      </main>
    </div>
  );
}

export default App;