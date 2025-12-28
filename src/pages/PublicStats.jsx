import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, YAxis } from 'recharts';
import { Search, Trophy, Users, Activity, Loader2 } from 'lucide-react';

const PublicStats = () => {
  const [polls, setPolls] = useState([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [searchId, setSearchId] = useState('');
  const [userVotes, setUserVotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // 訂閱即時更新
    const sub = supabase.channel('public-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, () => {
        fetchData();
        if(searchId) handleSearchUser(searchId);
      })
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  const fetchData = async () => {
    // 獲取所有投票及選項
    const { data: pollsData } = await supabase
      .from('polls')
      .select(`*, options(*)`)
      .order('sort_order', { ascending: true });

    if (pollsData) {
      let total = 0;
      pollsData.forEach(p => {
        p.options.sort((a,b) => a.id - b.id);
        p.totalPollVotes = p.options.reduce((acc, opt) => acc + opt.vote_count, 0);
        total += p.totalPollVotes;
      });
      setPolls(pollsData);
      setTotalVotes(total);
    }
    setLoading(false);
  };

const handleSearchUser = async (e) => {
      const id = e.target ? e.target.value : e;
      setSearchId(id);
      
      // 如果清空搜尋框，就清空結果
      if(!id.trim()) {
          setUserVotes([]);
          return;
      }
      
      // 使用 ilike 進行模糊搜尋 (%代表萬用字元)
      const { data, error } = await supabase.from('votes')
        .select('poll_id, option_id, polls(title), options(text), voter_identity')
        .ilike('voter_identity', `%${id}%`) // 改這裡：前後加 % 代表模糊搜尋
        .limit(20); // 限制顯示筆數，避免一次撈太多
        
      if(error) {
          console.error("Search error:", error);
      } else if(data) {
          setUserVotes(data);
      }
  };

  if (loading) return <div className="h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-gold-400 w-10 h-10"/></div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans p-4 md:p-8">
      {/* Header */}
      <header className="max-w-7xl mx-auto text-center mb-12">
        <motion.div 
            initial={{ y: -50, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }}
            className="inline-block p-4 rounded-full bg-gradient-to-r from-gold-900/20 to-black border border-gold-500/30 mb-6"
        >
            <Trophy className="w-12 h-12 text-gold-400 mx-auto" />
        </motion.div>
        <h1 className="text-4xl md:text-6xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-b from-gold-100 to-gold-600 mb-4">
            即時戰況中心
        </h1>
        <p className="text-zinc-500 tracking-widest uppercase text-sm">Real-time Statistics Dashboard</p>
        
        {/* 總票數卡片 */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <StatCard icon={<Activity/>} label="總投票數" value={totalVotes} />
            <StatCard icon={<Users/>} label="參與人數 (估計)" value={Math.floor(totalVotes * 0.8)} />
            <StatCard icon={<Trophy/>} label="獎項總數" value={polls.length} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-12">
        {/* 用戶查詢區 */}
        <section className="bg-zinc-900/30 border border-zinc-800 rounded-3xl p-8 backdrop-blur-sm">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Search className="text-gold-500"/> 用戶監測查詢
            </h2>
            <input 
                value={searchId}
                onChange={handleSearchUser}
                placeholder="輸入 Voter Identity (ID) 查詢投票紀錄..."
                className="w-full bg-black border border-zinc-700 p-4 rounded-xl text-gold-400 focus:border-gold-500 outline-none transition-all mb-6 font-mono"
            />
            {searchId && (
                <div className="space-y-2">
                    <p className="text-zinc-500 text-sm mb-2">搜尋結果: {userVotes.length} 筆紀錄</p>
                    {userVotes.length > 0 ? (
                        <div className="grid gap-2">
                            {userVotes.map((vote, i) => (
                                <div key={i} className="bg-black/50 p-4 rounded-lg border border-zinc-800 flex justify-between items-center">
                                    <span className="text-zinc-300">{vote.polls?.title}</span>
                                    <span className="text-gold-400 font-bold">{vote.options?.text}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-zinc-600">此 ID 尚未投票</p>
                    )}
                </div>
            )}
        </section>

        {/* 所有投票圖表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {polls.map(poll => {
                const data = poll.options.map(o => ({ name: o.text, votes: o.vote_count }));
                
                // 計算百分比並處理名稱過長問題
                const simplifiedData = data.map(d => {
                    // 計算百分比 (防止除以 0)
                    const percentage = poll.totalPollVotes > 0 
                        ? ((d.votes / poll.totalPollVotes) * 100).toFixed(1) + '%' 
                        : '0.0%';

                    return {
                        ...d,
                        displayName: d.name.length > 10 ? d.name.substring(0, 10) + '...' : d.name,
                        percentage: percentage // 把百分比存進去，等下 Tooltip 用
                    };
                });

                return (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        key={poll.id} 
                        className="bg-zinc-900/20 border border-zinc-800 p-6 rounded-2xl hover:border-gold-500/30 transition-colors"
                    >
                        <div className="flex justify-between items-start mb-6 border-b border-zinc-800 pb-4">
                            <h3 className="text-lg font-bold text-gold-100">{poll.title}</h3>
                            <span className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-400">Total: {poll.totalPollVotes}</span>
                        </div>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={simplifiedData} layout="vertical">
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="displayName" type="category" width={100} tick={{fill: '#888', fontSize: 10}} interval={0}/>
                                    
                                    {/* 修改 Tooltip 格式：顯示票數與百分比 */}
                                    <Tooltip 
                                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                        contentStyle={{ backgroundColor: '#000', borderColor: '#333', borderRadius: '8px' }} 
                                        itemStyle={{ color: '#D4AF37' }} 
                                        formatter={(value, name, props) => [
                                            `${value} 票 (${props.payload.percentage})`, // 顯示格式：100 票 (25.5%)
                                            '得票'
                                        ]}
                                    />
                                    
                                    <Bar dataKey="votes" radius={[0, 4, 4, 0]} barSize={20}>
                                        {data.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#D4AF37' : '#806921'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>
                );
            })}
        </div>
      </main>
      
      <footer className="mt-20 text-center text-zinc-700 text-xs">
        LIVE DATA • GOLDEN THREADS AWARDS 2025
      </footer>
    </div>
  );
};

const StatCard = ({ icon, label, value }) => (
    <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl flex items-center gap-4">
        <div className="p-3 bg-black rounded-full border border-zinc-700 text-gold-500">{icon}</div>
        <div className="text-left">
            <p className="text-zinc-500 text-xs uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-white font-mono">{value.toLocaleString()}</p>
        </div>
    </div>
);

export default PublicStats;