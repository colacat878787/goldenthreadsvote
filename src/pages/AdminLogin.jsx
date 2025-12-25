import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Lock } from 'lucide-react';

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

// src/pages/AdminLogin.jsx

// ... 前面的 import 保持不變

const handleLogin = async (e) => {
  e.preventDefault();
  setError('');

  // ▼▼▼ 修改這裡：改用 RPC 安全呼叫 ▼▼▼
  // 我們不再直接查詢資料表，而是呼叫後端函數 verify_admin
  const { data, error } = await supabase.rpc('verify_admin', { 
    user_input: username, 
    pass_input: password 
  });

  if (error) {
    console.error("Login RPC error:", error);
    setError('系統錯誤，請稍後再試');
  } else if (data) {
    // 登入成功 (data 裡面只有 id 和 username，沒有密碼)
    localStorage.setItem('admin_token', JSON.stringify(data));
    navigate('/panziiadmin/dashboard');
  } else {
    // 登入失敗 (data 為 null)
    setError('帳號或密碼錯誤，請檢查您的金脆獎權限');
  }
  // ▲▲▲ 修改結束 ▲▲▲
};

// ... 後面的 return 保持不變
  return (
    <div className="min-h-screen flex items-center justify-center bg-black relative">
       {/* 背景裝飾 */}
       <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gold-900/20 via-black to-black"></div>
       
       <div className="w-full max-w-md p-8 bg-zinc-900/80 backdrop-blur-xl border border-gold-800/30 rounded-3xl shadow-2xl relative z-10">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gold-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-gold-500/50">
                <Lock className="text-gold-400 w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white">管理員後台</h2>
            <p className="text-gold-500/60 text-sm mt-1">Golden Threads Awards Admin</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">帳號</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500 transition-all"
                placeholder="輸入管理員帳號"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">密碼</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500 transition-all"
                placeholder="輸入密碼"
              />
            </div>
            
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button 
              type="submit"
              className="w-full bg-gradient-to-r from-gold-600 to-gold-400 text-black font-bold py-3 rounded-lg hover:from-gold-500 hover:to-gold-300 transform hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)]"
            >
              進入控制台
            </button>
          </form>
       </div>
    </div>
  );
};

export default AdminLogin;