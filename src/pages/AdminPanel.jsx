import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Plus, Trash2, RefreshCw, LogOut, Settings, Clock, CheckCircle, Menu, X, ShieldAlert, Edit, ArrowUp, ArrowDown, Save, XCircle, Image as ImageIcon, UploadCloud, List, Ban, UserX } from 'lucide-react';
import { format } from 'date-fns';

const AdminPanel = () => {
  const navigate = useNavigate();
  const [authLoading, setAuthLoading] = useState(true);
  const [adminUser, setAdminUser] = useState(null);
  const [activeTab, setActiveTab] = useState('polls');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [polls, setPolls] = useState([]);
  const [siteSettings, setSiteSettings] = useState({});
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  // Logs & Bans
  const [voteLogs, setVoteLogs] = useState([]);
  const [bannedList, setBannedList] = useState([]);

  // Form States
  const [editingId, setEditingId] = useState(null);
  const [pollTitle, setPollTitle] = useState('');
  const [pollDesc, setPollDesc] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [pollOptions, setPollOptions] = useState([{ text: '', image: null, preview: null }, { text: '', image: null, preview: null }]);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('admin_token');
      if (!token) navigate('/panziiadmin');
      else {
        setAdminUser(JSON.parse(token));
        setAuthLoading(false); 
        fetchData();
      }
    };
    checkAuth();
  }, [navigate]);

  const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(null), 3000); };

  const fetchData = async () => {
    // Polls
    const { data: pollsData } = await supabase.from('polls').select(`*, options(*)`).order('sort_order', { ascending: true });
    if(pollsData) pollsData.forEach(p => p.options.sort((a,b) => a.id - b.id));
    setPolls(pollsData || []);
    
    // Settings
    const { data: settings } = await supabase.from('site_settings').select('*').single();
    setSiteSettings(settings || { status: 'waiting' });

    // Logs (最近 100 筆)
    const { data: logs } = await supabase.from('votes').select('*, polls(title), options(text)').order('created_at', { ascending: false }).limit(100);
    setVoteLogs(logs || []);

    // Bans
    const { data: bans } = await supabase.from('banned_voters').select('*').order('created_at', { ascending: false });
    setBannedList(bans || []);
  };

  const handleBanUser = async (identity) => {
      if(!confirm(`確定要封鎖此使用者 (ID: ${identity}) 嗎？\n他將無法再投票。`)) return;
      const { error } = await supabase.from('banned_voters').insert({ identity, reason: 'Admin Manual Ban' });
      if(error) showMsg("封鎖失敗: " + error.message);
      else {
          showMsg("已封鎖該使用者");
          fetchData();
      }
  };

  const handleUnbanUser = async (identity) => {
      if(!confirm("確定要解除封鎖嗎？")) return;
      const { error } = await supabase.from('banned_voters').delete().eq('identity', identity);
      if(error) showMsg("解封失敗");
      else {
          showMsg("已解除封鎖");
          fetchData();
      }
  };

  // ... (保留原本的圖片上傳、表單處理、排序、時間格式化邏輯) ...
  // 為節省篇幅，這裡省略中間重複的 helper functions，請使用上一個版本的邏輯
  // 但要記得把 fetchData 加入到那些 update 操作後
  // 這裡為了完整性，我還是會把關鍵的 UI 部分寫出來，helper 函式假設您已經有了 (如 handleSubmit, handleEditClick 等)
  
  // (此處請貼上您原本的 helper functions: handleUpdateStatus, handleImageSelect, handleRemoveImage, uploadImage, handleRemoveOption, handleSubmit, formatLocalTime, handleEditClick, resetForm, handleDeletePoll, handleMovePoll, handleChangePassword, handleLogout)
  // 若需完整代碼請參考上一則回應，並補上新的 Logs/Ban 邏輯

  // 簡化版 Helper (請自行補回或使用之前的)
  const handleUpdateStatus = async (s) => { await supabase.from('site_settings').update({ status: s }).eq('id', siteSettings.id); fetchData(); showMsg(`狀態更新: ${s}`); };
  const formatLocalTime = (iso) => { if(!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16); };
  const handleLogout = () => { localStorage.removeItem('admin_token'); navigate('/panziiadmin'); };
  
  // (以下省略重複的 Image/Form helpers，請直接使用舊有的)
  // ...

  if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center text-gold-500">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col lg:flex-row font-sans selection:bg-gold-500 selection:text-black overflow-x-hidden">
      {msg && <div className="fixed top-20 lg:top-5 left-1/2 -translate-x-1/2 lg:left-auto lg:right-5 lg:translate-x-0 bg-gold-500 text-black px-6 py-3 rounded-lg font-bold shadow-lg z-[100] animate-bounce flex items-center gap-2 whitespace-nowrap"><CheckCircle size={20} /> {msg}</div>}

      <div className="lg:hidden bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 p-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3"><button onClick={() => setIsSidebarOpen(true)} className="text-gold-400 p-2 hover:bg-zinc-800 rounded-lg"><Menu size={24} /></button><span className="font-bold text-gold-400 tracking-wider">PANZII ADMIN</span></div>
      </div>
      {isSidebarOpen && <div className="fixed inset-0 bg-black/80 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
      
      <aside className={`fixed lg:sticky top-0 left-0 h-full w-64 bg-black border-r border-zinc-800 p-6 flex flex-col z-50 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-4"><h1 className="text-xl font-bold text-gold-400 tracking-wider">PANZII ADMIN</h1><button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-zinc-500"><X size={24}/></button></div>
        <nav className="space-y-2 flex-1">
          <TabButton icon={<Plus size={18}/>} label="投票管理" active={activeTab === 'polls'} onClick={() => {setActiveTab('polls'); setIsSidebarOpen(false);}} />
          <TabButton icon={<List size={18}/>} label="投票紀錄" active={activeTab === 'logs'} onClick={() => {setActiveTab('logs'); setIsSidebarOpen(false);}} />
          <TabButton icon={<Ban size={18}/>} label="黑名單管理" active={activeTab === 'bans'} onClick={() => {setActiveTab('bans'); setIsSidebarOpen(false);}} />
          <TabButton icon={<RefreshCw size={18}/>} label="數據統計" active={activeTab === 'stats'} onClick={() => {setActiveTab('stats'); setIsSidebarOpen(false);}} />
          <TabButton icon={<Settings size={18}/>} label="系統設定" active={activeTab === 'settings'} onClick={() => {setActiveTab('settings'); setIsSidebarOpen(false);}} />
        </nav>
        <button onClick={handleLogout} className="flex items-center gap-2 text-zinc-500 hover:text-red-400 text-sm mt-auto transition-colors p-2"><LogOut size={16}/> 登出</button>
      </aside>

      <main className="flex-1 p-4 lg:p-10 bg-zinc-900/20 min-h-screen">
        {/* Status Bar */}
        <div className="bg-black border border-zinc-800 p-5 lg:p-6 rounded-2xl mb-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-xl">
            <div className="w-full lg:w-auto">
                <h3 className="text-zinc-500 text-xs font-bold uppercase mb-3 tracking-widest">Global Status</h3>
                <div className="flex flex-wrap gap-2 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
                    {['waiting', 'voting', 'ended'].map(status => (<button key={status} onClick={() => handleUpdateStatus(status)} className={`flex-1 lg:flex-none px-3 lg:px-6 py-2 rounded-lg lg:rounded-full text-[10px] lg:text-xs font-bold uppercase transition-all duration-300 whitespace-nowrap ${siteSettings.status === status ? 'bg-gold-500 text-black shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}>{status}</button>))}
                </div>
            </div>
            <div className="w-full lg:w-auto flex justify-between lg:block border-t border-zinc-800 pt-3 lg:border-0 lg:pt-0 lg:text-right"><p className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] self-center">Active Polls</p><p className="text-gold-500 font-serif text-3xl lg:text-4xl font-bold">{polls.length}</p></div>
        </div>

        {/* --- 分頁內容 --- */}
        {activeTab === 'polls' && (
            <div className="text-center text-zinc-500">
                {/* 這裡請貼回原本的 polls grid 區塊 (Form + List)，為避免回覆過長被截斷，請保留您原本的代碼 */}
                <p>請保留原本的投票管理介面代碼...</p>
            </div>
        )}

        {/* 1. 投票紀錄 Log */}
        {activeTab === 'logs' && (
            <div className="bg-black border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-6 border-b border-zinc-800"><h3 className="font-bold text-white flex items-center gap-2"><List className="text-gold-500"/> 近期投票紀錄 (最新 100 筆)</h3></div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-900/50 text-zinc-400 uppercase text-xs">
                            <tr>
                                <th className="p-4">時間</th>
                                <th className="p-4">投票項目</th>
                                <th className="p-4">選擇</th>
                                <th className="p-4">Voter ID / IP</th>
                                <th className="p-4">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {voteLogs.map(log => (
                                <tr key={log.id} className="hover:bg-zinc-900/30 transition-colors">
                                    <td className="p-4 text-zinc-500 font-mono">{format(new Date(log.created_at), 'MM/dd HH:mm:ss')}</td>
                                    <td className="p-4 font-bold text-white">{log.polls?.title}</td>
                                    <td className="p-4 text-gold-400">{log.options?.text}</td>
                                    <td className="p-4 font-mono text-xs text-zinc-400">
                                        <div>ID: {log.voter_identity}</div>
                                        <div className="text-zinc-600">IP: {log.ip_address || 'Unknown'}</div>
                                    </td>
                                    <td className="p-4">
                                        <button onClick={() => handleBanUser(log.voter_identity)} className="px-3 py-1 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 text-xs border border-red-900/50">Ban User</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* 2. 黑名單管理 */}
        {activeTab === 'bans' && (
            <div className="bg-black border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-6 border-b border-zinc-800"><h3 className="font-bold text-white flex items-center gap-2"><Ban className="text-red-500"/> 黑名單列表</h3></div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-900/50 text-zinc-400 uppercase text-xs">
                            <tr>
                                <th className="p-4">封鎖 ID</th>
                                <th className="p-4">原因</th>
                                <th className="p-4">封鎖時間</th>
                                <th className="p-4">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {bannedList.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-zinc-600">目前沒有黑名單</td></tr>}
                            {bannedList.map(ban => (
                                <tr key={ban.identity} className="hover:bg-zinc-900/30 transition-colors">
                                    <td className="p-4 font-mono text-white">{ban.identity}</td>
                                    <td className="p-4 text-zinc-400">{ban.reason}</td>
                                    <td className="p-4 text-zinc-500 font-mono">{format(new Date(ban.created_at), 'MM/dd HH:mm')}</td>
                                    <td className="p-4">
                                        <button onClick={() => handleUnbanUser(ban.identity)} className="px-3 py-1 bg-green-900/30 text-green-400 rounded hover:bg-green-900/50 text-xs border border-green-900/50">解除封鎖</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* Stats & Settings (同前) */}
        {/* ... */}
      </main>
    </div>
  );
};

const TabButton = ({ icon, label, active, onClick }) => (<button onClick={onClick} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-all duration-300 ${active ? 'bg-gold-500 text-black font-bold shadow-[0_0_15px_rgba(212,175,55,0.3)]' : 'text-zinc-500 hover:bg-zinc-900 hover:text-white'}`}>{icon} <span className="text-sm">{label}</span></button>);

export default AdminPanel;