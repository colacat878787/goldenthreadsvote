import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Plus, Trash2, RefreshCw, LogOut, Settings, Clock, CheckCircle, Menu, X, ShieldAlert, Edit, ArrowUp, ArrowDown, Save, XCircle } from 'lucide-react';
import { format } from 'date-fns';

const AdminPanel = () => {
  const navigate = useNavigate();
  
  // 安全驗證
  const [authLoading, setAuthLoading] = useState(true);
  const [adminUser, setAdminUser] = useState(null);
  
  // 介面
  const [activeTab, setActiveTab] = useState('polls');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // 數據
  const [polls, setPolls] = useState([]);
  const [siteSettings, setSiteSettings] = useState({});
  const [msg, setMsg] = useState(null);

  // 表單狀態
  const [editingId, setEditingId] = useState(null); // 如果有值，代表正在編輯
  const [pollTitle, setPollTitle] = useState('');
  const [pollDesc, setPollDesc] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  
  // 密碼修改
  const [newPassword, setNewPassword] = useState('');

  // 1. 權限檢查
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        navigate('/panziiadmin');
      } else {
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
    // 改為依照 sort_order 排序
    const { data: pollsData } = await supabase
      .from('polls')
      .select(`*, options(*)`)
      .order('sort_order', { ascending: true }); // 數字越小越上面
      
    setPolls(pollsData || []);
    
    const { data: settings } = await supabase.from('site_settings').select('*').single();
    setSiteSettings(settings || { status: 'waiting' });
  };

  const handleUpdateStatus = async (status) => {
    await supabase.from('site_settings').update({ status }).eq('id', siteSettings.id);
    fetchData();
    showMsg(`網站狀態已更新為: ${status}`);
  };

  // --- 刪除功能 ---
  const handleDeletePoll = async (id) => {
      if (!confirm("⚠️ 警告：確定要刪除？\n這將會永久刪除該投票的所有數據！")) return;
      
      await supabase.from('votes').delete().eq('poll_id', id);
      await supabase.from('options').delete().eq('poll_id', id);
      const { error } = await supabase.from('polls').delete().eq('id', id);

      if (error) {
          showMsg("刪除失敗：" + error.message);
      } else {
          showMsg("刪除成功");
          // 如果正在編輯這個被刪除的，要重置表單
          if (editingId === id) resetForm();
          fetchData();
      }
  };

  // --- 排序功能 (上移/下移) ---
  const handleMovePoll = async (index, direction) => {
      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === polls.length - 1) return;

      const currentPoll = polls[index];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const targetPoll = polls[targetIndex];

      // 交換 sort_order
      // 為了安全，我們直接交換兩個 ID 的 order
      const { error: err1 } = await supabase.from('polls').update({ sort_order: targetPoll.sort_order }).eq('id', currentPoll.id);
      const { error: err2 } = await supabase.from('polls').update({ sort_order: currentPoll.sort_order }).eq('id', targetPoll.id);

      if (!err1 && !err2) {
          fetchData(); // 重新抓取就會看到順序變了
      } else {
          showMsg("排序失敗，請稍後再試");
      }
  };

  // --- 進入編輯模式 ---
  const handleEditClick = (poll) => {
      setEditingId(poll.id);
      setPollTitle(poll.title);
      setPollDesc(poll.description || '');
      // 時間格式轉換給 input datetime-local 用 (去掉秒數後面)
      setStartAt(poll.start_at ? poll.start_at.slice(0, 16) : '');
      setEndAt(poll.end_at ? poll.end_at.slice(0, 16) : '');
      
      // 選項暫時不支援在「編輯模式」增刪，因為會影響投票數據
      // 我們這裡只顯示，不讓改選項 (如果要改選項文字比較複雜，先鎖定)
      setPollOptions(poll.options.map(o => o.text));
      
      showMsg(`正在編輯: ${poll.title}`);
      
      // 手機版自動捲動到上方
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- 重置表單 ---
  const resetForm = () => {
      setEditingId(null);
      setPollTitle('');
      setPollDesc('');
      setStartAt('');
      setEndAt('');
      setPollOptions(['', '']);
  };

  // --- 提交 (新增 或 更新) ---
  const handleSubmit = async () => {
    if (!pollTitle) return showMsg("請輸入標題");

    if (editingId) {
        // === 更新模式 ===
        const { error } = await supabase.from('polls').update({
            title: pollTitle,
            description: pollDesc,
            start_at: startAt ? new Date(startAt).toISOString() : null,
            end_at: endAt ? new Date(endAt).toISOString() : null,
        }).eq('id', editingId);

        if (error) {
            showMsg("更新失敗: " + error.message);
        } else {
            showMsg("更新成功！(選項內容暫不支援修改)");
            resetForm();
            fetchData();
        }

    } else {
        // === 新增模式 ===
        // 找出目前最小的 sort_order，新增加的放在更上面 (sort_order - 1)
        const minOrder = polls.length > 0 ? Math.min(...polls.map(p => p.sort_order)) : 0;

        const { data: poll, error } = await supabase.from('polls').insert({
            title: pollTitle,
            description: pollDesc,
            is_active: true,
            start_at: startAt ? new Date(startAt).toISOString() : null,
            end_at: endAt ? new Date(endAt).toISOString() : null,
            sort_order: minOrder - 1, // 讓新的排在最上面
        }).select().single();

        if (error) return showMsg("建立失敗: " + error.message);

        const optionsData = pollOptions
            .filter(t => t.trim() !== '')
            .map(text => ({ poll_id: poll.id, text }));
        
        await supabase.from('options').insert(optionsData);
        
        showMsg("投票建立成功！");
        resetForm();
        fetchData();
        setIsSidebarOpen(false);
    }
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

  if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center text-gold-500">Loading...</div>;

  const inputClass = "w-full bg-zinc-950 border border-zinc-700 p-3 rounded-lg text-white focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-colors text-sm placeholder-zinc-600";

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col lg:flex-row font-sans selection:bg-gold-500 selection:text-black overflow-x-hidden">
      
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

      {/* Sidebar Overlay */}
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
        
        {/* Status Bar */}
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
                {/* Create/Edit Form */}
                <div className="lg:col-span-1 bg-black border border-zinc-800 p-5 lg:p-6 rounded-2xl h-fit shadow-lg order-2 lg:order-1 transition-all">
                    <h3 className={`font-bold mb-6 flex items-center gap-2 text-lg border-b border-zinc-800 pb-4 ${editingId ? 'text-blue-400' : 'text-gold-100'}`}>
                        {editingId ? <><Edit size={20}/> 編輯投票</> : <><Plus className="text-gold-500"/> 新增投票</>}
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block font-bold">投票標題</label>
                            <input className={inputClass} placeholder="請輸入標題..." value={pollTitle} onChange={e => setPollTitle(e.target.value)} />
                        </div>
                        
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block font-bold">描述 (選填)</label>
                            <textarea className={`${inputClass} h-24 resize-none`} placeholder="關於這個投票..." value={pollDesc} onChange={e => setPollDesc(e.target.value)} />
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

                        {/* 如果是新增模式才顯示選項編輯，編輯模式鎖定選項以免影響數據 */}
                        {!editingId ? (
                            <div className="space-y-3 pt-4 border-t border-zinc-800 mt-4">
                                <label className="text-xs text-zinc-500 uppercase font-bold flex justify-between items-center">
                                    選項 <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">{pollOptions.length}</span>
                                </label>
                                {pollOptions.map((opt, idx) => (
                                    <div key={idx} className="relative group">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-xs font-mono">{String(idx + 1).padStart(2,'0')}</span>
                                        <input 
                                            className={`${inputClass} pl-10`}
                                            placeholder={`輸入選項...`}
                                            value={opt}
                                            onChange={e => {
                                                const newOpts = [...pollOptions];
                                                newOpts[idx] = e.target.value;
                                                setPollOptions(newOpts);
                                            }}
                                        />
                                        {pollOptions.length > 2 && (
                                            <button 
                                                onClick={() => {const newOpts = pollOptions.filter((_, i) => i !== idx); setPollOptions(newOpts);}}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-red-500 p-2"
                                            >
                                                <Trash2 size={14}/>
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={() => setPollOptions([...pollOptions, ''])} className="w-full py-2 border border-dashed border-zinc-700 text-zinc-500 text-xs rounded hover:border-gold-500 hover:text-gold-500 transition-colors">
                                    + 增加選項
                                </button>
                            </div>
                        ) : (
                            <div className="pt-4 border-t border-zinc-800 mt-4">
                                <p className="text-xs text-zinc-500 mb-2">⚠️ 編輯模式下無法修改選項 (防止數據損壞)</p>
                                <div className="flex flex-wrap gap-2">
                                    {pollOptions.map((opt, i) => (
                                        <span key={i} className="bg-zinc-900 text-zinc-400 px-2 py-1 rounded text-xs border border-zinc-800">{opt}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 mt-6">
                            {editingId && (
                                <button 
                                    onClick={resetForm} 
                                    className="flex-1 bg-zinc-800 text-zinc-400 font-bold py-3 rounded-lg hover:bg-zinc-700 flex items-center justify-center gap-2"
                                >
                                    <XCircle size={18}/> 取消
                                </button>
                            )}
                            <button 
                                onClick={handleSubmit} 
                                className={`flex-[2] font-bold py-3 rounded-lg transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(212,175,55,0.2)] flex items-center justify-center gap-2
                                    ${editingId ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-gold-500 text-black hover:bg-gold-400'}`}
                            >
                                {editingId ? <><Save size={18}/> 保存修改</> : <><Plus size={18}/> 確認發布</>}
                            </button>
                        </div>
                    </div>
                </div>

                {/* List */}
                <div className="lg:col-span-2 space-y-4 order-1 lg:order-2">
                    <div className="flex justify-between items-end mb-2">
                        <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Active Poll List</h3>
                        <span className="text-[10px] text-zinc-600">依照自訂順序排列</span>
                    </div>
                    
                    {polls.length === 0 ? (
                        <div className="text-center py-20 border border-dashed border-zinc-800 rounded-2xl text-zinc-600">
                            目前沒有任何投票，請新增。
                        </div>
                    ) : (
                        polls.map((poll, index) => (
                            <div key={poll.id} className={`bg-black border p-5 lg:p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start gap-4 transition-all shadow-lg
                                ${editingId === poll.id ? 'border-blue-500/50 shadow-blue-900/20' : 'border-zinc-800 hover:border-gold-500/50'}
                            `}>
                                {/* 排序按鈕區 (左側) */}
                                <div className="flex sm:flex-col gap-1 sm:pr-4 sm:border-r border-zinc-800 self-center sm:self-stretch justify-center">
                                    <button 
                                        onClick={() => handleMovePoll(index, 'up')}
                                        disabled={index === 0}
                                        className={`p-1 rounded hover:bg-zinc-800 ${index === 0 ? 'text-zinc-800 cursor-default' : 'text-zinc-400 hover:text-gold-400'}`}
                                    >
                                        <ArrowUp size={20}/>
                                    </button>
                                    <button 
                                        onClick={() => handleMovePoll(index, 'down')}
                                        disabled={index === polls.length - 1}
                                        className={`p-1 rounded hover:bg-zinc-800 ${index === polls.length - 1 ? 'text-zinc-800 cursor-default' : 'text-zinc-400 hover:text-gold-400'}`}
                                    >
                                        <ArrowDown size={20}/>
                                    </button>
                                </div>

                                <div className="w-full pl-0 sm:pl-2">
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
                                
                                <div className="flex sm:flex-col gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                    <button 
                                        onClick={() => handleEditClick(poll)} 
                                        className="flex-1 sm:flex-none p-3 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-blue-600/20 hover:border-blue-500 border border-transparent rounded-xl transition-all flex justify-center items-center"
                                        title="編輯"
                                    >
                                        <Edit size={18}/>
                                    </button>
                                    <button 
                                        onClick={() => handleDeletePoll(poll.id)} 
                                        className="flex-1 sm:flex-none p-3 bg-zinc-900 text-zinc-500 hover:text-white hover:bg-red-600 rounded-xl transition-all shadow-md flex justify-center items-center"
                                        title="刪除"
                                    >
                                        <Trash2 size={18}/>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        )}
        
        {/* Stats 和 Settings 的內容保持不變 (為了版面簡潔，我這裡省略重複代碼，請保留你原本的 Stats 和 Settings 區塊，或直接使用我上方完整代碼) */}
        {/* ... (如果你需要我也把 Stats 和 Settings 貼出來請告訴我，但上面已經是完整的了) ... */}
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