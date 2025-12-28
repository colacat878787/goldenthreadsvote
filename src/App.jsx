import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import AdminLogin from './pages/AdminLogin';
import AdminPanel from './pages/AdminPanel';
import PublicStats from './pages/PublicStats'; // 新頁面

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-black text-white selection:bg-gold-400 selection:text-black">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/votenumb" element={<PublicStats />} />
          <Route path="/panziiadmin" element={<AdminLogin />} />
          <Route path="/panziiadmin/dashboard" element={<AdminPanel />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;