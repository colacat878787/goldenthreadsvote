import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';
import { Loader2, ChevronDown, Award, Lock, ZoomIn, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LOGO_URL = "https://i.ibb.co/Q3jzj8r3/601973223-17842560999666048-6924136326722950788-n.jpg";

// 內部通知組件
const Toast = ({ message, onClose }) => (
  <motion.div 
    initial={{ opacity: 0, y: 50 }} 
    animate={{ opacity: 1, y: 0 }} 
    exit={{ opacity: 0, y: 50 }}
    className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900 border border-gold-400 text-gold-100 px-6 py-3 rounded-full shadow-[0_0_20px_rgba(212,175,55,0.3)] z-50 flex items-center gap-2"
  >
    <Award size={16} /> {message}
  </motion.div>
);

// 圖片放大 Lightbox 組件
const ImageLightbox = ({ src, onClose }) => {
  if (!src) return null;
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-sm"
    >
      {/* 關閉按鈕 */}
      <button className="absolute top-5 right-5 text-zinc-500 hover:text-white p-2">
        <X size={32} />
      </button>
      
      <motion.img 
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        src={src} 
        className="max-w-full max-h-screen object-contain shadow-2xl rounded-lg"
        onClick={(e) => e.stopPropagation()} // 點圖片不關閉，點背景才關閉
      />
    </motion.div>
  );
};

const Home = () => {
  const navigate = useNavigate();
  const [siteStatus, setSiteStatus] = useState('waiting');
  const [polls, setPolls] = useState([]);
  const [votedMap, setVotedMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const [toastMsg, setToastMsg] = useState('');
  
  // 新增：放大的圖片 URL
  const [zoomedImage, setZoomedImage] = useState(null);
  
  const pollsSectionRef = useRef(null);

  const getVoterId = () => {
    let id = localStorage.getItem('voter_id');
    if (!id) {
      id = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('voter_id', id);
    }
    return id;
  };

  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), 3500);
    fetchData();
    
    const subscription = supabase.channel('public:site_settings')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'site_settings' }, fetchData)
      .subscribe();
      
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchData = async () => {
    const { data: settings } = await supabase.from('site_settings').select('*').single();
    if (settings) setSiteStatus(settings.status);

    const { data: pollsData } = await supabase
      .from('polls')
      .select(`*, options(*)`)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }); // 確保照順序排
    
    // 過濾時間
    const activePolls = pollsData?.filter(p => {
        // 如果現在時間小於開始時間 -> 不顯示 (或顯示未開始，看需求，這邊先照舊邏輯)
        if (p.start_at && new Date() < new Date(p.start_at)) return false;
        // 如果現在時間大於結束時間 -> 不顯示 (或顯示已結束)
        if (p.end_at && new Date() > new Date(p.end_at)) return false;
        return true;
    }) || [];

    // 整理選項 ID 順序
    activePolls.forEach(poll => {
      poll.options.sort((a, b) => a.id - b.id);
    });

    setPolls(activePolls);
    
    const voterId = getVoterId();
    const { data: votes } = await supabase.from('votes').select('poll_id, option_id').eq('voter_identity', voterId);
    
    if (votes) {
      const map = {};
      votes.forEach(v => {
        map[v.poll_id] = v.option_id;
      });
      setVotedMap(map);
    }

    setLoading(false);
  };

  const handleVote = async (pollId, optionId) => {
    if (siteStatus !== 'voting') {
        showToast("目前不是投票時段");
        return;
    }
    if (votedMap[pollId]) return;

    setVotedMap(prev => ({ ...prev, [pollId]: optionId }));
    showToast("投票成功！感謝您的參與");

    const { error } = await supabase.rpc('increment_vote', {
      option_id_input: optionId,
      poll_id_input: pollId,
      voter_id_input: getVoterId()
    });

    if (error) {
      console.error(error);
      showToast("投票發生錯誤，請重試");
    }
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const scrollToPolls = () => {
    pollsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleAdminClick = () => {
      navigate('/panziiadmin');
  };

  if (loading) return <div className="h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-gold-400 w-10 h-10" /></div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-gold-400 selection:text-black overflow-hidden relative">
      
      {/* Lightbox */}
      <AnimatePresence>
        {zoomedImage && <ImageLightbox src={zoomedImage} onClose={() => setZoomedImage(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg('')} />}
        
        {showIntro && (
          <motion.div 
            className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 1.5, ease: "easeInOut" } }}
          >
            <motion.img 
              src={LOGO_URL} 
              initial={{ scale: 0.8, opacity: 0, filter: "blur(10px)" }}
              animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 1.5 }}
              className="w-40 h-40 rounded-full mb-8 border border-gold-500/30 shadow-[0_0_100px_rgba(212,175,55,0.5)]"
            />
            <motion.h1 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="text-4xl font-luxury text-gold-gradient tracking-[0.3em]"
            >
              2025 金脆獎
            </motion.h1>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.header 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 3.5 }}
        className="min-h-screen flex flex-col items-center justify-center relative z-10 px-4"
      >
        <div className="relative group cursor-pointer">
            <div className="absolute inset-0 bg-gold-400 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-700"></div>
            <img src={LOGO_URL} alt="Logo" className="w-48 h-48 md:w-64 md:h-64 rounded-full border-[1px] border-gold-500/50 object-cover relative z-10 shadow-2xl" />
        </div>

        <h1 className="text-6xl md:text-8xl font-luxury mt-12 mb-4 text-center text-gold-gradient drop-shadow-lg">
          2025 金脆獎
        </h1>
        <p className="text-gold-200/60 tracking-[0.5em] text-sm md:text-lg uppercase mb-12">Golden Threads Awards</p>

        <div className="max-w-xl text-center space-y-4 text-zinc-400 font-light leading-relaxed mb-12 glass-card p-8 rounded-2xl">
          <p>這是一場，屬於 Threads 的帳號與創作的頒獎典禮。</p>
          <p className="text-gold-400 font-medium">#Threads第一個非官方頒獎典禮</p>
          <div className="w-12 h-[1px] bg-gold-500/30 mx-auto my-4"></div>
          <p className="text-sm">由 <span className="text-white">@panzii___</span> 於洗澡時想到並創辦</p>
          <div className="flex justify-center gap-4 text-[10px] text-zinc-600 uppercase tracking-widest mt-6">
             <span>Non-Profit</span> • <span>Community</span> • <span>2025</span>
          </div>
        </div>

        <motion.button 
          onClick={scrollToPolls}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="group flex flex-col items-center gap-2 text-gold-400 text-sm tracking-widest hover:text-white transition-colors cursor-pointer"
        >
          <span className="uppercase border-b border-transparent group-hover:border-gold-400 pb-1">進入投票</span>
          <ChevronDown className="animate-bounce" />
        </motion.button>
      </motion.header>

      <main ref={pollsSectionRef} className="max-w-6xl mx-auto px-4 py-24 relative z-10 min-h-[80vh]">
        <div className="text-center mb-16">
           <h2 className="text-3xl md:text-4xl font-luxury text-white mb-2">年度獎項</h2>
           <div className="w-24 h-1 bg-gradient-to-r from-transparent via-gold-500 to-transparent mx-auto"></div>
        </div>

        <AnimatePresence mode="wait">
          {siteStatus === 'waiting' && (
            <motion.div 
              key="waiting"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-20 glass-card rounded-3xl"
            >
              <h3 className="text-3xl text-gold-200 font-light mb-4">投票通道準備中</h3>
              <p className="text-gray-500">請密切關注，準備為你喜愛的創作者應援。</p>
            </motion.div>
          )}

          {siteStatus === 'ended' && (
            <motion.div 
              key="ended"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-32 glass-card rounded-3xl border-gold-500/20"
            >
              <Award className="w-20 h-20 text-gold-400 mx-auto mb-6" />
              <h3 className="text-5xl font-luxury text-gold-gradient mb-4">投票已結束</h3>
              <p className="text-xl text-gray-300">即將迎接頒獎典禮，敬請期待結果揭曉。</p>
            </motion.div>
          )}

          {siteStatus === 'voting' && (
            <div key="voting" className="grid gap-16">
              {polls.map((poll, index) => (
                <PollCard 
                  key={poll.id} 
                  poll={poll} 
                  index={index} 
                  votedOptionId={votedMap[poll.id]} 
                  onVote={handleVote}
                  onZoom={setZoomedImage} // 傳遞放大函數
                />
              ))}
              {polls.length === 0 && <p className="text-center text-gray-500">目前沒有符合時間的投票項目。</p>}
            </div>
          )}
        </AnimatePresence>
      </main>
      
      <footer className="py-12 text-center border-t border-zinc-900 bg-black relative z-10 flex flex-col items-center gap-4">
         <p className="text-zinc-600 text-xs tracking-widest uppercase">© 2025 Golden Threads Awards. All rights reserved.</p>
         
         <button 
            onClick={handleAdminClick} 
            className="text-zinc-900 hover:text-zinc-800 transition-colors p-2"
            title="Admin Login"
         >
            <Lock size={12} />
         </button>
      </footer>
    </div>
  );
};

// 獨立的投票卡片組件 (圖片顯示優化)
const PollCard = ({ poll, index, votedOptionId, onVote, onZoom }) => {
  const hasVoted = !!votedOptionId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6 }}
      className="glass-card rounded-[2rem] p-8 md:p-12 relative overflow-hidden group"
    >
      <div className="absolute top-0 right-0 p-6 opacity-10">
        <span className="text-9xl font-luxury text-white">{String(index + 1).padStart(2, '0')}</span>
      </div>

      <div className="mb-10 relative z-10">
        <h3 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
          {poll.title}
        </h3>
        {poll.description && <p className="text-zinc-400 text-lg max-w-2xl font-light">{poll.description}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        {poll.options.map((option) => {
           const isSelected = votedOptionId === option.id;
           const isDisabled = hasVoted; 

           return (
            <motion.button
              key={option.id}
              whileHover={!isDisabled ? { scale: 1.02, y: -5 } : {}}
              whileTap={!isDisabled ? { scale: 0.98 } : {}}
              onClick={() => onVote(poll.id, option.id)}
              disabled={isDisabled}
              className={`
                relative p-6 rounded-2xl text-left transition-all duration-300 flex items-center gap-6 group/btn border overflow-hidden
                ${isSelected 
                  ? 'bg-gold-600/20 border-gold-500 ring-1 ring-gold-500/50' 
                  : 'bg-black/40 border-zinc-800 hover:border-gold-500/50 hover:bg-zinc-900/60'}
                ${isDisabled && !isSelected ? 'opacity-30 grayscale' : 'opacity-100'}
              `}
            >
              {option.image_url ? (
                  // 優化後的圖片顯示：完整顯示 (contain)，背景黑，點擊可放大
                  <div 
                    className="relative w-24 h-24 md:w-32 md:h-32 flex-shrink-0 bg-black rounded-lg overflow-hidden border border-zinc-700 group/img"
                    onClick={(e) => {
                        e.stopPropagation(); // 阻止冒泡，避免點圖觸發投票
                        onZoom(option.image_url); // 放大圖片
                    }}
                  >
                      <img 
                        src={option.image_url} 
                        className="w-full h-full object-contain hover:scale-110 transition-transform duration-500 cursor-zoom-in" 
                        alt={option.text}
                      />
                      {/* 放大鏡提示 */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none">
                          <ZoomIn className="text-white w-6 h-6" />
                      </div>
                  </div>
              ) : (
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border flex-shrink-0 ${isSelected ? 'border-gold-400 text-gold-400' : 'border-zinc-700 text-zinc-500 group-hover/btn:border-gold-400/50'}`}>
                    <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-gold-400' : 'bg-transparent group-hover/btn:bg-gold-400'}`}></div>
                  </div>
              )}
              
              <div className="flex-1 min-w-0">
                <span className={`text-xl font-medium break-words ${isSelected ? 'text-gold-100' : 'text-zinc-300 group-hover/btn:text-white'}`}>
                    {option.text}
                </span>
              </div>

              {isSelected && (
                  <motion.div initial={{scale:0}} animate={{scale:1}} className="text-gold-400 font-bold text-xs uppercase tracking-widest border border-gold-400 px-3 py-1 rounded-full whitespace-nowrap">
                      已投票
                  </motion.div>
              )}
            </motion.button>
           )
        })}s
      </div>
    </motion.div>
  );
};

export default Home;