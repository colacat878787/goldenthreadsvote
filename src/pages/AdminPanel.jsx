import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Plus, Trash2, RefreshCw, LogOut, Settings, Clock, CheckCircle, Menu, X, ShieldAlert, Edit, ArrowUp, ArrowDown, Save, XCircle, Image as ImageIcon, UploadCloud } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);

  // 表單狀態
  const [editingId, setEditingId] = useState(null);
  const [pollTitle, setPollTitle] = useState('');
  const [pollDesc, setPollDesc] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  
  // 選項狀態
  const [pollOptions, setPollOptions] = useState([
    { text: '', image: null, preview: null }, 
    { text: '', image: null, preview: null }
  ]);
  
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
    const { data: pollsData } = await supabase
      .from('polls')
      .select(`*, options(*)`)
      .order('sort_order', { ascending: true });
      
    if(pollsData) {
        pollsData.forEach(p => {
            p.options.sort((a,b) => a.id - b.id);
        });
    }

    setPolls(pollsData || []);
    const { data: settings } = await supabase.from('site_settings').select('*').single();
    setSiteSettings(settings || { status: 'waiting' });
  };

  const handleUpdateStatus = async (status) => {
    await supabase.from('site_settings').update({ status }).eq('id', siteSettings.id);
    fetchData();
    showMsg(`網站狀態已更新為: ${status}`);
  };

  // --- 圖片處理 ---
  const handleImageSelect = (index, e) => {
      const file = e.target.files[0];
      if (file) {
          const newOpts = [...pollOptions];
          newOpts[index].image = file;
          newOpts[index].preview = URL.createObjectURL(file);
          setPollOptions(newOpts);
      }
  };

  const handleRemoveImage = (index) => {
      const newOpts = [...pollOptions];
      newOpts[index].image = null;
      newOpts[index].preview = null;
      setPollOptions(newOpts);
  };

  // --- 上傳到 Supabase Storage ---
  const uploadImage = async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      // 上傳
      const { error } = await supabase.storage.from('poll_images').upload(filePath, file);
      if (error) {
          console.error('Upload Error:', error);
          return null;
      }

      // 取得公開連結
      const { data } = supabase.storage.from('poll_images').getPublicUrl(filePath);
      return data.publicUrl;
  };

  // --- 提交 ---
  const handleSubmit = async () => {
    if (!pollTitle) return showMsg("請輸入標題");
    setLoading(true);

    try {
        let currentPollId = editingId;

        // 1. Poll
        if (editingId) {
            const { error } = await supabase.from('polls').update({
                title: pollTitle,
                description: pollDesc,
                start_at: startAt ? new Date(startAt).toISOString() : null,
                end_at: endAt ? new Date(endAt).toISOString() : null,
            }).eq('id', editingId);
            if (error) throw error;
        } else {
            const minOrder = polls.length > 0 ? Math.min(...polls.map(p => p.sort_order)) : 0;
            const { data: poll, error } = await supabase.from('polls').insert({
                title: pollTitle,
                description: pollDesc,
                is_active: true,
                start_at: startAt ? new Date(startAt).toISOString() : null,
                end_at: endAt ? new Date(endAt).toISOString() : null,
                sort_order: minOrder - 1,
            }).select().single();
            if (error) throw error;
            currentPollId = poll.id;
        }

        // 2. Options
        for (const opt of pollOptions) {
            if (!opt.text && !opt.preview) continue;

            let imageUrl = opt.preview;
            // 如果使用者選了新檔案 (File 物件)，就上傳
            if (opt.image instanceof File) {
                imageUrl = await uploadImage(opt.image);
            }

            const optionData = {
                poll_id: currentPollId,
                text: opt.text,
                image_url: imageUrl
            };

            if (opt.id) {
                await supabase.from('options').update(optionData).eq('id', opt.id);
            } else {
                if (!editingId) await supabase.from('options').insert(optionData);
            }
        }

        showMsg(editingId ? "更新成功！" : "發布成功！");
        resetForm();
        fetchData();
        if(!editingId) setIsSidebarOpen(false);

    } catch (err) {
        console.error(err);
        showMsg("發生錯誤: " + err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleEditClick = (poll) => {
      setEditingId(poll.id);
      setPollTitle(poll.title);
      setPollDesc(poll.description || '');
      setStartAt(poll.start_at ? poll.start_at.slice(0, 16) : '');
      setEndAt(poll.end_at ? poll.end_at.slice(0, 16) : '');
      setPollOptions(poll.options.map(o => ({
          id: o.id,
          text: o.text,
          image: null,
          preview: o.image_url 
      })));
      showMsg(`正在編輯: ${poll.title}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
      setEditingId(null);
      setPollTitle('');
      setPollDesc('');
      setStartAt('');
      setEndAt('');
      setPollOptions([{ text: '', image: null, preview: null }, { text: '', image: null, preview: null }]);
  };
  
  const handleDeletePoll = async (id) => {
      if (!confirm("⚠️ 警告：確定要刪除？")) return;
      await supabase.from('votes').delete().eq('poll_id', id);
      await supabase.from('options').delete().eq('poll_id', id);
      const { error } = await supabase.from('polls').delete().eq('id', id);
      if (error) showMsg("刪除失敗：" + error.message);
      else {
          showMsg("刪除成功");
          if (editingId === id) resetForm();
          fetchData();
      }
  };

  const handleMovePoll = async (index, direction) => {
      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === polls.length - 1) return;
      const currentPoll = polls[index];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const targetPoll = polls[targetIndex];
      const { error: err1 } = await supabase.from('polls').update({ sort_order: targetPoll.sort_order }).eq('id', currentPoll.id);
      const { error: err2 } = await supabase.from('polls').update({ sort_order: currentPoll.sort_order }).eq('id', targetPoll.id);
      if (!err1 && !err2) fetchData();
  };

  const handleChangePassword = async () => {
      if(!newPassword) return;
      await supabase.from('admins').update({ password: newPassword }).eq('id', adminUser.id);
      showMsg("密碼已更新，請重新登入");
      setTimeout(() => { localStorage.removeItem('admin_token'); navigate('/panziiadmin'); }, 1500);
  };
  const handleLogout = () => { localStorage.removeItem('admin_token'); navigate('/panziiadmin'); }

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
            <button onClick={() => setIsSidebarOpen(true)} className="text-gold-400 p-2 hover:bg-zinc-800 rounded-lg"><Menu size={24} /></button>
            <span className="font-bold text-gold-400 tracking-wider">PANZII ADMIN</span>
        </div>
      </div>

      {isSidebarOpen && <div className="fixed inset-0 bg-black/80 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
      
      <aside className={`fixed lg:sticky top-0 left-0 h-full w-64 bg-black border-r border-zinc-800 p-6 flex flex-col z-50 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-4">
            <h1 className="text-xl font-bold text-gold-400 tracking-wider">PANZII ADMIN</h1>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-zinc-500"><X size={24}/></button>
        </div>
        <nav className="space-y-2 flex-1">
          <TabButton icon={<Plus size={18}/>} label="投票管理" active={activeTab === 'polls'} onClick={() => {setActiveTab('polls'); setIsSidebarOpen(false);}} />
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
                    {['waiting', 'voting', 'ended'].map(status => (
                        <button key={status} onClick={() => handleUpdateStatus(status)} className={`flex-1 lg:flex-none px-3 lg:px-6 py-2 rounded-lg lg:rounded-full text-[10px] lg:text-xs font-bold uppercase transition-all duration-300 whitespace-nowrap ${siteSettings.status === status ? 'bg-gold-500 text-black shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}>
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
                {/* Form */}
                <div className="lg:col-span-1 bg-black border border-zinc-800 p-5 lg:p-6 rounded-2xl h-fit shadow-lg order-2 lg:order-1 transition-all">
                    <h3 className={`font-bold mb-6 flex items-center gap-2 text-lg border-b border-zinc-800 pb-4 ${editingId ? 'text-blue-400' : 'text-gold-100'}`}>
                        {editingId ? <><Edit size={20}/> 編輯投票</> : <><Plus className="text-gold-500"/> 新增投票</>}
                    </h3>
                    
                    <div className="space-y-4">
                        <input className={inputClass} placeholder="投票標題" value={pollTitle} onChange={e => setPollTitle(e.target.value)} />
                        <textarea className={`${inputClass} h-24 resize-none`} placeholder="描述 (選填)" value={pollDesc} onChange={e => setPollDesc(e.target.value)} />
                        
                        <div className="grid grid-cols-2 gap-3">
                             <input type="datetime-local" className={inputClass} style={{ colorScheme: 'dark' }} value={startAt} onChange={e => setStartAt(e.target.value)} />
                             <input type="datetime-local" className={inputClass} style={{ colorScheme: 'dark' }} value={endAt} onChange={e => setEndAt(e.target.value)} />
                        </div>

                        {/* 選項編輯區 - 支援電腦上傳 */}
                        <div className="space-y-3 pt-4 border-t border-zinc-800 mt-4">
                            <label className="text-xs text-zinc-500 uppercase font-bold flex justify-between items-center">
                                選項 <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">{pollOptions.length}</span>
                            </label>
                            
                            {pollOptions.map((opt, idx) => (
                                <div key={idx} className="relative group bg-zinc-950/50 p-3 rounded-lg border border-zinc-800 hover:border-zinc-600 transition-colors">
                                    <div className="flex gap-2 items-center mb-3">
                                        <span className="text-zinc-600 text-xs font-mono w-4">{idx + 1}</span>
                                        <input 
                                            className="bg-transparent border-b border-zinc-800 w-full text-sm text-white focus:border-gold-500 outline-none pb-1"
                                            placeholder={`選項內容 (選填)`}
                                            value={opt.text}
                                            disabled={editingId && opt.id}
                                            onChange={e => {
                                                const newOpts = [...pollOptions];
                                                newOpts[idx].text = e.target.value;
                                                setPollOptions(newOpts);
                                            }}
                                        />

                                        {pollOptions.length > 2 && !editingId && (
                                            <button 
                                                onClick={() => {const newOpts = pollOptions.filter((_, i) => i !== idx); setPollOptions(newOpts);}}
                                                className="text-zinc-600 hover:text-red-500 p-1"
                                            >
                                                <Trash2 size={16}/>
                                            </button>
                                        )}
                                    </div>
                                    
                                    {/* 圖片上傳區塊 - 這裡就是你要的功能 */}
                                    {opt.preview ? (
                                        <div className="relative w-full h-32 bg-black rounded-lg overflow-hidden border border-zinc-800 group/img">
                                            <img src={opt.preview} alt="Preview" className="w-full h-full object-cover" />
                                            <button 
                                                onClick={() => handleRemoveImage(idx)}
                                                className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-2 hover:bg-red-500 transition-colors"
                                            >
                                                <X size={16}/>
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center w-full h-20 border border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-gold-500 hover:bg-zinc-900/50 transition-all group/upload">
                                            <div className="flex items-center gap-2 text-zinc-500 group-hover/upload:text-gold-400">
                                                <UploadCloud size={20} />
                                                <span className="text-xs">點擊從電腦上傳圖片</span>
                                            </div>
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                className="hidden" 
                                                onChange={(e) => handleImageSelect(idx, e)}
                                            />
                                        </label>
                                    )}
                                </div>
                            ))}
                            
                            {!editingId && (
                                <button onClick={() => setPollOptions([...pollOptions, { text: '', image: null, preview: null }])} className="w-full py-2 border border-dashed border-zinc-700 text-zinc-500 text-xs rounded hover:border-gold-500 hover:text-gold-500 transition-colors">
                                    + 增加選項
                                </button>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6">
                            {editingId && (
                                <button onClick={resetForm} className="flex-1 bg-zinc-800 text-zinc-400 font-bold py-3 rounded-lg hover:bg-zinc-700 flex items-center justify-center gap-2">
                                    <XCircle size={18}/> 取消
                                </button>
                            )}
                            <button 
                                onClick={handleSubmit} 
                                disabled={loading}
                                className={`flex-[2] font-bold py-3 rounded-lg transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(212,175,55,0.2)] flex items-center justify-center gap-2
                                    ${editingId ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-gold-500 text-black hover:bg-gold-400'}
                                    ${loading ? 'opacity-50 cursor-not-allowed' : ''}
                                `}
                            >
                                {loading ? '上傳中...' : (editingId ? <><Save size={18}/> 保存修改</> : <><Plus size={18}/> 確認發布</>)}
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
                            <div key={poll.id} className={`bg-black border p-5 lg:p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start gap-4 transition-all shadow-lg ${editingId === poll.id ? 'border-blue-500/50 shadow-blue-900/20' : 'border-zinc-800 hover:border-gold-500/50'}`}>
                                <div className="flex sm:flex-col gap-1 sm:pr-4 sm:border-r border-zinc-800 self-center sm:self-stretch justify-center">
                                    <button onClick={() => handleMovePoll(index, 'up')} disabled={index === 0} className={`p-1 rounded hover:bg-zinc-800 ${index === 0 ? 'text-zinc-800 cursor-default' : 'text-zinc-400 hover:text-gold-400'}`}><ArrowUp size={20}/></button>
                                    <button onClick={() => handleMovePoll(index, 'down')} disabled={index === polls.length - 1} className={`p-1 rounded hover:bg-zinc-800 ${index === polls.length - 1 ? 'text-zinc-800 cursor-default' : 'text-zinc-400 hover:text-gold-400'}`}><ArrowDown size={20}/></button>
                                </div>
                                <div className="w-full pl-0 sm:pl-2">
                                    <div className="flex flex-wrap items-center gap-3 mb-2">
                                        <h4 className="font-bold text-white text-lg lg:text-xl font-serif">{poll.title}</h4>
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${poll.is_active ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400'}`}>{poll.is_active ? 'Active' : 'Hidden'}</span>
                                    </div>
                                    <p className="text-zinc-400 text-sm mb-4 line-clamp-2">{poll.description || "無描述"}</p>
                                    
                                    {/* 這裡也可以顯示選項有幾張圖 */}
                                    <div className="flex flex-wrap gap-2 text-[10px] lg:text-xs text-zinc-500 font-mono">
                                        <div className="flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded"><ImageIcon size={12} className="text-gold-500"/><span>{poll.options.filter(o=>o.image_url).length} 圖片</span></div>
                                        <div className="flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded"><CheckCircle size={12} className="text-gold-500"/><span>{poll.options.length} 選項</span></div>
                                    </div>
                                </div>
                                <div className="flex sm:flex-col gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                    <button onClick={() => handleEditClick(poll)} className="flex-1 sm:flex-none p-3 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-blue-600/20 hover:border-blue-500 border border-transparent rounded-xl transition-all flex justify-center items-center"><Edit size={18}/></button>
                                    <button onClick={() => handleDeletePoll(poll.id)} className="flex-1 sm:flex-none p-3 bg-zinc-900 text-zinc-500 hover:text-white hover:bg-red-600 rounded-xl transition-all shadow-md flex justify-center items-center"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        )}

        {/* ... Stats & Settings ... */}
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
                        <input type="password" placeholder="輸入新的管理員密碼" className={inputClass} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    </div>
                    <button onClick={handleChangePassword} className="bg-zinc-800 text-white border border-zinc-700 px-4 py-3 rounded-lg font-bold hover:bg-gold-600 hover:text-black hover:border-gold-500 w-full transition-all">更新密碼並重新登入</button>
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

const TabButton = ({ icon, label, active, onClick }) => (
    <button onClick={onClick} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-all duration-300 ${active ? 'bg-gold-500 text-black font-bold shadow-[0_0_15px_rgba(212,175,55,0.3)]' : 'text-zinc-500 hover:bg-zinc-900 hover:text-white'}`}>
        {icon} <span className="text-sm">{label}</span>
    </button>
);

export default AdminPanel;