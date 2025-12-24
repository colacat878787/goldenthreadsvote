import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Plus, Trash2, RefreshCw, LogOut, Settings, Clock, CheckCircle, Menu, X, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';

const AdminPanel = () => {
  const navigate = useNavigate();
  
  // 安全性驗證狀態
  const [authLoading, setAuthLoading] = useState(true);
  const [adminUser, setAdminUser] = useState(null);
  
  // 介面狀態
  const [activeTab, setActiveTab] = useState('polls');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // 手機側邊欄控制
  
  // 數據狀態
  const [polls, setPolls] = useState([]);
  const [siteSettings, setSiteSettings] = useState({});
  const [msg, setMsg] = useState(null);

  // 新增投票表單狀態
  const [newPollTitle, setNewPollTitle] = useState('');
  const [newPollDesc, setNewPollDesc] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [newPollOptions, setNewPollOptions] = useState(['', '']);
  
  // 密碼修改狀態
  const [newPassword, setNewPassword] = useState('');

  // 1. 安全性檢查：在渲染畫面之前執行
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        // 如果沒有 token，直接踢回登入頁
        navigate('/panziiadmin');
      } else {
        // 有 token 才允許設定使用者並顯示畫面
        setAdminUser(JSON.parse(token));
        setAuthLoading(false); 
        fetchData();
      }
    };
    checkAuth();
  }, [navigate]);

  const showMsg = (text) => {
      setMsg(text);
      setTimeout(() => setMsg(null), 3000);
  };

  const fetchData = async () => {
    const { data: pollsData } = await supabase.from('polls').select(`*, options(*)`).order('created_at', { ascending: false });
    setPolls(pollsData || []);
    const { data: settings } = await supabase.from('site_settings').select('*').single();
    setSiteSettings(settings || { status: 'waiting' });
  };

  const handleUpdateStatus = async (status) => {
    await supabase.from('site_settings').update({ status }).eq('id', siteSettings.id);
    fetchData();
    showMsg(`網站狀態已更新為: ${status}`);
  };

  const handleDeletePoll = async (id) => {
      if (!confirm("⚠️ 警告：確定要刪除？\n這將會永久刪除該投票的所有「選項」與「投票紀錄」！")) return;
      
      await supabase.from('votes').delete().eq('poll_id', id);
      await supabase.from('options').delete().eq('poll_id', id);
      const { error } = await supabase.from('polls').delete().eq('id', id);

      if (error) {
          console.error(error);
          showMsg("刪除失敗：" + error.message);
      } else {
          showMsg("刪除成功");
          fetchData();
      }
  };

  const handleCreatePoll = async () => {
    if (!newPollTitle) return showMsg("請輸入標題");
    
    const { data: poll, error } = await supabase.from('polls').insert({
      title: newPollTitle,
      description: newPollDesc,
      is_active: true,
      start_at: startAt ? new Date(startAt).toISOString() : null,
      end_at: endAt ? new Date(endAt).toISOString() : null,
    }).select().single();

    if (error) return showMsg("建立失敗: " + error.message);

    const optionsData = newPollOptions
      .filter(t => t.trim() !== '')
      .map(text => ({ poll_id: poll.id, text }));
    
    await supabase.from('options').insert(optionsData);
    
    setNewPollTitle('');
    setNewPollDesc('');
    setStartAt('');
    setEndAt('');
    setNewPollOptions(['', '']);
    fetchData();
    showMsg("投票建立成功！");
    setIsSidebarOpen(false); // 手機版建立後關閉選單 (如果有的話，這裡通常不需要，但保留彈性)
    setActiveTab('polls');
  };

  const handleChangePassword = async () => {
      if(!newPassword) return;
      await supabase.from('admins').update({ password: newPassword }).eq('id', adminUser.id);
      showMsg("密碼已更新，請重新登入");
      setTimeout(() => {
          localStorage.removeItem('admin_token');
          navigate('/panziiadmin');
      }, 1500);
  };

  const handleLogout = () => {
      localStorage.removeItem('admin_token');
      navigate('/panziiadmin');
  }

  // 如果還在驗證身分，不渲染任何東西 (防止閃現)
  if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center text-gold-500">Verifying Access...</div>;

  const inputClass = "w-full bg-zinc-950 border border-zinc-700 p-3 rounded-lg text-white focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-colors text-sm placeholder-zinc-600";

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col lg:flex-row font-sans selection:bg-gold-500 selection:text-black overflow-x-hidden">
      
      {/* Toast Notification */}
      {msg && (
          <div className="fixed top-20 lg:top-5 left-1/2 -translate-x-1/2 lg:left-auto lg:right-5 lg:translate-x-0 bg-gold-500 text-black px-6 py-3 rounded-lg font-bold shadow-lg z-[100] animate-bounce flex items-center gap-2 whitespace-nowrap">
              <CheckCircle size={20} /> {msg}
          </div>
      )}

      {/* Mobile Top Bar */}
      <div className="lg:hidden bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 p-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="text-gold-400 p-2 hover:bg-zinc-800 rounded-lg">
                <Menu size={24} />
            </button>
            <span className="font-bold text-gold-400 tracking-wider">PANZII ADMIN</span>
        </div>
      </div>

      {/* Sidebar (Desktop: Fixed, Mobile: Drawer) */}
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/80 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>
      )}
      
      <aside className={`
          fixed lg:sticky top-0 left-0 h-full w-64 bg-black border-r border-zinc-800 p-6 flex flex-col z-50 transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-4">
            <h1 className="text-xl font-bold text-gold-400 tracking-wider">PANZII ADMIN</h1>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-zinc-500"><X size={24}/></button>
        </div>
        
        <nav className="space-y-2 flex-1">
          <TabButton icon={<Plus size={18}/>} label="投票管理" active={activeTab === 'polls'} onClick={() => {setActiveTab('polls'); setIsSidebarOpen(false);}} />
          <TabButton icon={<RefreshCw size={18}/>} label="數據統計" active={activeTab === 'stats'} onClick={() => {setActiveTab('stats'); setIsSidebarOpen(false);}} />
          <TabButton icon={<Settings size={18}/>} label="系統設定" active={activeTab === 'settings'} onClick={() => {setActiveTab('settings'); setIsSidebarOpen(false);}} />
        </nav>
        
        <button onClick={handleLogout} className="flex items-center gap-2 text-zinc-500 hover:text-red-400 text-sm mt-auto transition-colors p-2">
            <LogOut size={16}/> 登出
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-10 bg-zinc-900/20 min-h-screen">
        
        {/* Status Bar (Responsive) */}
        <div className="bg-black border border-zinc-800 p-5 lg:p-6 rounded-2xl mb-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-xl">
            <div className="w-full lg:w-auto">
                <h3 className="text-zinc-500 text-xs font-bold uppercase mb-3 tracking-widest flex items-center gap-2">
                    Global Status <span className="h-px flex-1 bg-zinc-800 lg:hidden"></span>
                </h3>
                <div className="flex flex-wrap gap-2 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
                    {['waiting', 'voting', 'ended'].map(status => (
                        <button
                            key={status}
                            onClick={() => handleUpdateStatus(status)}
                            className={`flex-1 lg:flex-none px-3 lg:px-6 py-2 rounded-lg lg:rounded-full text-[10px] lg:text-xs font-bold uppercase transition-all duration-300 whitespace-nowrap
                                ${siteSettings.status === status 
                                    ? 'bg-gold-500 text-black shadow-[0_0_15px_rgba(212,175,55,0.4)]' 
                                    : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}
                            `}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>
            <div className="w-full lg:w-auto flex justify-between lg:block border-t border-zinc-800 pt-3 lg:border-0 lg:pt-0 lg:text-right">
                <p className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] self-center">Active Polls</p>
                <p className="text-gold-500 font-serif text-3xl lg:text-4xl font-bold">{polls.length}</p>
            </div>
        </div>

        {activeTab === 'polls' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Create Form */}
                <div className="lg:col-span-1 bg-black border border-zinc-800 p-5 lg:p-6 rounded-2xl h-fit shadow-lg order-2 lg:order-1">
                    <h3 className="text-gold-100 font-bold mb-6 flex items-center gap-2 text-lg border-b border-zinc-800 pb-4">
                        <Plus className="text-gold-500"/> 新增投票
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block font-bold">投票標題</label>
                            <input className={inputClass} placeholder="請輸入標題..." value={newPollTitle} onChange={e => setNewPollTitle(e.target.value)} />
                        </div>
                        
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block font-bold">描述 (選填)</label>
                            <textarea className={`${inputClass} h-24 resize-none`} placeholder="關於這個投票..." value={newPollDesc} onChange={e => setNewPollDesc(e.target.value)} />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                             <div>
                                <label className="text-xs text-zinc-500 mb-1 block font-bold">開始時間</label>
                                <input type="datetime-local" className={inputClass} style={{ colorScheme: 'dark' }} value={startAt} onChange={e => setStartAt(e.target.value)} />
                             </div>
                             <div>
                                <label className="text-xs text-zinc-500 mb-1 block font-bold">結束時間</label>
                                <input type="datetime-local" className={inputClass} style={{ colorScheme: 'dark' }} value={endAt} onChange={e => setEndAt(e.target.value)} />
                             </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-zinc-800 mt-4">
                            <label className="text-xs text-zinc-500 uppercase font-bold flex justify-between items-center">
                                選項 <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">{newPollOptions.length}</span>
                            </label>
                            {newPollOptions.map((opt, idx) => (
                                <div key={idx} className="relative group">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-xs font-mono">{String(idx + 1).padStart(2,'0')}</span>
                                    <input 
                                        className={`${inputClass} pl-10`}
                                        placeholder={`輸入選項...`}
                                        value={opt}
                                        onChange={e => {
                                            const newOpts = [...newPollOptions];
                                            newOpts[idx] = e.target.value;
                                            setNewPollOptions(newOpts);
                                        }}
                                    />
                                    {newPollOptions.length > 2 && (
                                        <button 
                                            onClick={() => {const newOpts = newPollOptions.filter((_, i) => i !== idx); setNewPollOptions(newOpts);}}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-red-500 p-2"
                                        >
                                            <Trash2 size={14}/>
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button onClick={() => setNewPollOptions([...newPollOptions, ''])} className="w-full py-2 border border-dashed border-zinc-700 text-zinc-500 text-xs rounded hover:border-gold-500 hover:text-gold-500 transition-colors">
                                + 增加選項
                            </button>
                        </div>

                        <button onClick={handleCreatePoll} className="w-full bg-gold-500 text-black font-bold py-3 rounded-lg hover:bg-gold-400 transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(212,175,55,0.2)] mt-6">
                            確認發布
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="lg:col-span-2 space-y-4 order-1 lg:order-2">
                    <div className="flex justify-between items-end mb-2">
                        <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Active Poll List</h3>
                    </div>
                    
                    {polls.length === 0 ? (
                        <div className="text-center py-20 border border-dashed border-zinc-800 rounded-2xl text-zinc-600">
                            目前沒有任何投票，請新增。
                        </div>
                    ) : (
                        polls.map(poll => (
                            <div key={poll.id} className="bg-black border border-zinc-800 p-5 lg:p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start gap-4 group hover:border-gold-500/50 transition-colors shadow-lg">
                                <div className="w-full">
                                    <div className="flex flex-wrap items-center gap-3 mb-2">
                                        <h4 className="font-bold text-white text-lg lg:text-xl font-serif">{poll.title}</h4>
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${poll.is_active ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400'}`}>
                                            {poll.is_active ? 'Active' : 'Hidden'}
                                        </span>
                                    </div>
                                    <p className="text-zinc-400 text-sm mb-4 line-clamp-2">{poll.description || "無描述"}</p>
                                    
                                    <div className="flex flex-wrap gap-2 text-[10px] lg:text-xs text-zinc-500 font-mono">
                                        <div className="flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded">
                                            <CheckCircle size={12} className="text-gold-500"/>
                                            <span>{poll.options.length} 選項</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded">
                                            <Clock size={12} className="text-gold-500"/>
                                            <span>
                                                {poll.start_at ? format(new Date(poll.start_at), 'MM/dd HH:mm') : '即時'} ➜ {poll.end_at ? format(new Date(poll.end_at), 'MM/dd HH:mm') : '無期限'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => handleDeletePoll(poll.id)} className="w-full sm:w-auto p-3 bg-zinc-900 text-zinc-500 hover:text-white hover:bg-red-600 rounded-xl transition-all shadow-md flex justify-center items-center">
                                    <Trash2 size={20}/>
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        )}

        {activeTab === 'stats' && (
            <div>
                 <h2 className="text-2xl lg:text-3xl font-serif font-bold text-gold-gradient mb-8">即時投票統計</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {polls.map(poll => {
                        const data = poll.options.map(o => ({ name: o.text, votes: o.vote_count }));
                        return (
                        <div key={poll.id} className="bg-black p-4 lg:p-6 rounded-2xl border border-zinc-800 shadow-xl">
                            <h4 className="text-gold-100 font-bold mb-6 text-center border-b border-zinc-800 pb-4 text-lg">{poll.title}</h4>
                            <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data}>
                                <XAxis dataKey="name" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip cursor={{fill: 'rgba(212, 175, 55, 0.1)'}} contentStyle={{ backgroundColor: '#000', borderColor: '#333', borderRadius: '8px' }} itemStyle={{ color: '#D4AF37' }} />
                                <Bar dataKey="votes" radius={[4, 4, 0, 0]} animationDuration={1500}>
                                    {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#D4AF37' : '#806921'} />
                                    ))}
                                </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                            </div>
                        </div>
                        )
                    })}
                </div>
            </div>
        )}

        {activeTab === 'settings' && (
            <div className="max-w-md bg-black border border-zinc-800 p-8 rounded-2xl shadow-xl">
                <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2 border-b border-zinc-800 pb-4">
                    <ShieldAlert size={20} className="text-gold-500"/> 帳戶安全
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-zinc-500 mb-1 block font-bold">設定新密碼</label>
                        <input 
                            type="password"
                            placeholder="輸入新的管理員密碼"
                            className={inputClass}
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={handleChangePassword} 
                        className="bg-zinc-800 text-white border border-zinc-700 px-4 py-3 rounded-lg font-bold hover:bg-gold-600 hover:text-black hover:border-gold-500 w-full transition-all"
                    >
                        更新密碼並重新登入
                    </button>
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

// Tab 按鈕
const TabButton = ({ icon, label, active, onClick }) => (
    <button onClick={onClick} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-all duration-300 ${active ? 'bg-gold-500 text-black font-bold shadow-[0_0_15px_rgba(212,175,55,0.3)]' : 'text-zinc-500 hover:bg-zinc-900 hover:text-white'}`}>
        {icon} <span className="text-sm">{label}</span>
    </button>
);

export default AdminPanel;