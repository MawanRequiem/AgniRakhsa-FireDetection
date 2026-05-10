import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame, Send, BarChart3, Activity,
  Cpu, ShieldCheck, Zap, BookOpen
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  Tooltip
} from 'recharts';
import { customFetch } from '@/lib/api';
import ScrollReveal from '@landing/components/ui/ScrollReveal';

// 1. BRANDING & COLORS
const THEME = {
  negative: { color: '#ef4444', label: 'BAHAYA NYATA', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  positive: { color: '#22c55e', label: 'AMAN/TERKENDALI', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  netral: { color: '#94a3b8', label: 'AKTIVITAS RUTIN', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  konflik: { color: '#a855f7', label: 'VIRAL/ENGAGEMENT', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
};

export default function SentimenAnalisisX() {
  const [reportText, setReportText] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [stats, setStats] = useState({ negative: 0, positive: 0, netral: 0, konflik: 0 });
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeMode, setActiveMode] = useState('manual'); // 'manual' or 'x'
  const [searchQuery, setSearchQuery] = useState('kebakaran');
  const [xResults, setXResults] = useState([]);

  const filteredXResults = useMemo(() => {
    if (activeFilter === 'all') return xResults;
    return xResults.filter(item => item.finalKey === activeFilter);
  }, [xResults, activeFilter]);

  const chartData = useMemo(() => [
    { name: 'Negative', value: stats.negative || 1, color: THEME.negative.color },
    { name: 'Positive', value: stats.positive || 1, color: THEME.positive.color },
    { name: 'Netral', value: stats.netral || 1, color: THEME.netral.color },
    { name: 'Konflik', value: stats.konflik || 1, color: THEME.konflik.color },
  ], [stats]);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!reportText.trim() || loading) return;
    setLoading(true);
    try {
      const response = await customFetch('/api/v1/nlp/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: reportText }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Server error");
      }

      const data = await response.json();
      if (!data.label) throw new Error("Invalid response from server");

      const raw = String(data.label).toLowerCase().trim();
      let finalKey = 'konflik';
      if (raw.includes('neg')) finalKey = 'negative';
      else if (raw.includes('pos')) finalKey = 'positive';
      else if (raw.includes('neu')) finalKey = 'netral';
      else if (raw.includes('con')) finalKey = 'konflik';

      const confidence = data.confidence ? (data.confidence > 1 ? data.confidence / 100 : data.confidence) : 0;
      setAnalysisResult({
        text: reportText,
        label: finalKey.toUpperCase(),
        confidence: confidence,
        ...THEME[finalKey]
      });
      setStats(prev => ({ ...prev, [finalKey]: prev[finalKey] + 1 }));
      setReportText('');
    } catch (error) {
      console.error("Error:", error);
      alert(`Analisis Gagal: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchX = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || loading) return;
    setLoading(true);
    setXResults([]);

    try {
      const response = await customFetch(`/api/v1/nlp/analyze-x?query=${encodeURIComponent(searchQuery)}&count=10`);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Gagal mengambil data X");
      }

      const res = await response.json();
      if (res.status === 'success') {
        const mappedResults = res.data.map(item => {
          const raw = String(item.analysis.label).toLowerCase().trim();
          let finalKey = 'konflik';
          if (raw.includes('neg')) finalKey = 'negative';
          else if (raw.includes('pos')) finalKey = 'positive';
          else if (raw.includes('neu')) finalKey = 'netral';
          else if (raw.includes('con')) finalKey = 'konflik';

          // Update stats
          setStats(prev => ({ ...prev, [finalKey]: prev[finalKey] + 1 }));

          return {
            ...item,
            theme: THEME[finalKey],
            finalKey
          };
        });
        setXResults(mappedResults);
      } else {
        console.warn(res.message || "Tidak ada data ditemukan.");
      }
    } catch (error) {
      console.error("X Search Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch initial data on mount
  useEffect(() => {
    handleSearchX();
  }, []);

  return (
    <div className="section-dark min-h-screen pt-32 pb-20">
      <div className="container-wide">
        <ScrollReveal>
          <div className="text-center mb-16 space-y-6">
            <h1 className="text-5xl md:text-7xl font-display font-bold text-white leading-tight">
              SENTIMEN <span className="text-ifrit-red">ANALISIS X</span>
            </h1>
            <p className="text-text-on-dark-muted text-lg mx-auto italic">
              Validasi laporan kebakaran secara instan menggunakan arsitektur Bi-LSTM.
            </p>

            <div className="flex justify-center gap-4 mt-8">
              {[
                { id: 'manual', label: 'LAPORAN MANUAL', icon: Send },
                { id: 'x', label: 'CRAWL DATA X', icon: Activity }
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => {
                    setActiveMode(mode.id);
                    setAnalysisResult(null);
                    setXResults([]);
                  }}
                  className={`px-8 py-3 rounded-full flex items-center gap-3 font-bold text-xs tracking-widest transition-all cursor-pointer border ${activeMode === mode.id
                      ? 'bg-ifrit-red border-ifrit-red text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                      : 'bg-transparent border-white/10 text-text-on-dark-muted hover:border-white/30'
                    }`}
                >
                  <mode.icon size={16} />
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </ScrollReveal>

        <div className="grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7 space-y-10">
            <ScrollReveal delay={100}>
              {activeMode === 'manual' ? (
                <form onSubmit={handleAnalyze} className="bg-dark-surface border border-dark-border p-8 rounded-2xl shadow-2xl space-y-6">
                  <div className="flex items-center gap-2 text-text-on-dark-muted">
                    <Activity size={16} className="text-ifrit-red" />
                    <span className="text-xs font-bold uppercase tracking-widest">Input Laporan Terkini</span>
                  </div>
                  <textarea
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    placeholder="Ceritakan kejadian... (Contoh: Ada api menyambar kabel di Lab Elektro PNJ)"
                    className="w-full h-44 bg-dark-bg border border-dark-border rounded-xl p-6 text-xl focus:ring-2 focus:ring-ifrit-red outline-none transition-all resize-none text-white"
                  />
                  <button
                    disabled={loading || !reportText.trim()}
                    className="w-full py-5 bg-ifrit-red hover:bg-ifrit-red-light disabled:opacity-50 rounded-xl font-display font-bold text-white shadow-xl transition-all flex items-center justify-center gap-3 cursor-pointer"
                  >
                    {loading ? "PROSES ALGORITMA..." : <><Send size={20} /> ANALISIS SEKARANG</>}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSearchX} className="bg-dark-surface border border-dark-border p-8 rounded-2xl shadow-2xl space-y-6">
                  <div className="flex items-center gap-2 text-text-on-dark-muted">
                    <Activity size={16} className="text-ifrit-red" />
                    <span className="text-xs font-bold uppercase tracking-widest">Keyword Search (Twitter/X)</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Masukkan kata kunci... (kebakaran, asap, api)"
                      className="w-full bg-dark-bg border border-dark-border rounded-xl py-5 px-6 text-xl focus:ring-2 focus:ring-ifrit-red outline-none transition-all text-white"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-white/20">
                      <BarChart3 size={20} />
                    </div>
                  </div>
                  <button
                    disabled={loading || !searchQuery.trim()}
                    className="w-full py-5 bg-ifrit-red hover:bg-ifrit-red-light disabled:opacity-50 rounded-xl font-display font-bold text-white shadow-xl transition-all flex items-center justify-center gap-3 cursor-pointer"
                  >
                    {loading ? "MENGUMPULKAN DATA..." : <><Activity size={20} /> MULAI PENCARIAN & ANALISIS</>}
                  </button>
                </form>
              )}
            </ScrollReveal>

            <AnimatePresence mode="wait">
              {activeMode === 'manual' && analysisResult && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-10 rounded-2xl border ${analysisResult.border} ${analysisResult.bg} backdrop-blur-sm`}
                >
                  <h2 className="text-5xl font-display font-bold italic uppercase tracking-tighter mb-4" style={{ color: analysisResult.color }}>
                    {analysisResult.label}
                  </h2>
                  <p className="text-2xl text-white/90 italic font-medium mb-10 border-l-4 border-white/20 pl-8">
                    "{analysisResult.text}"
                  </p>
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div className="flex items-center gap-2 opacity-50 text-white">
                        <Cpu size={14} />
                        <span className="text-xs font-bold uppercase">Bi-LSTM Confidence</span>
                      </div>
                      <span className="text-3xl font-mono font-bold" style={{ color: analysisResult.color }}>
                        {(analysisResult.confidence * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="h-3 bg-black/40 rounded-full p-0.5 border border-white/5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${analysisResult.confidence * 100}%` }}
                        transition={{ duration: 1 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: analysisResult.color }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {activeMode === 'x' && xResults.length > 0 && (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
                  {xResults.map((tweet, idx) => (
                    <motion.div
                      key={tweet.tweet_id || idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`p-6 rounded-xl border ${tweet.theme.border} ${tweet.theme.bg} backdrop-blur-sm flex flex-col gap-3 group relative overflow-hidden`}
                    >
                      <div className="flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold text-white border border-white/10">
                            {tweet.author?.[0]?.toUpperCase() || 'X'}
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">Author</p>
                            <p className="text-xs font-bold text-white tracking-wider">@{tweet.author}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1" style={{ color: tweet.theme.color }}>
                            {tweet.theme.label}
                          </p>
                          <p className="text-lg font-mono font-bold" style={{ color: tweet.theme.color }}>
                            {tweet.analysis.confidence.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-white/80 italic leading-relaxed relative z-10">
                        "{tweet.text}"
                      </p>

                      {/* Confidence bar subtle */}
                      <div className="absolute bottom-0 left-0 h-1 bg-white/5 w-full">
                        <div
                          className="h-full opacity-50"
                          style={{ backgroundColor: tweet.theme.color, width: `${tweet.analysis.confidence}%` }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <ScrollReveal delay={200}>
              <div className="bg-dark-surface border border-dark-border p-8 rounded-2xl shadow-2xl">
                <div className="h-[280px] w-full mb-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={75}
                        outerRadius={105}
                        dataKey="value"
                        paddingAngle={8}
                        stroke="none"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#171B24', border: 'none', borderRadius: '12px', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(THEME).map(([key, config]) => (
                    <div key={key} className="p-5 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col items-center">
                      <span className="text-[10px] font-bold opacity-30 uppercase tracking-widest mb-2 text-white">
                        {config.label}
                      </span>
                      <span className="text-3xl font-bold" style={{ color: config.color }}>
                        {stats[key]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>

        {/* DATASET REFERENCE */}
        <section className="mt-32 space-y-10">
          <ScrollReveal>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-ifrit-red">
                  <Activity size={20} />
                  <span className="text-xs font-bold uppercase tracking-[0.3em]">Live Feed X Analysis</span>
                </div>
                <h2 className="text-4xl font-display font-bold text-white italic">LAPORAN <span className="opacity-30">TERKINI</span></h2>
              </div>
              <div className="flex flex-wrap gap-2 p-1.5 bg-white/5 rounded-xl border border-white/10">
                {['all', 'negative', 'positive', 'netral', 'konflik'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer ${activeFilter === f
                        ? 'bg-ifrit-red text-white'
                        : 'text-text-on-dark-muted hover:text-white'
                      }`}
                  >
                    {f === 'all' ? 'SEMUA' : THEME[f]?.label || f}
                  </button>
                ))}
              </div>
            </div>
          </ScrollReveal>

          <div className="max-h-[800px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-ifrit-red/30 scrollbar-track-transparent">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredXResults.length > 0 ? (
                  filteredXResults.map((item, index) => (
                    <motion.div
                      key={item.tweet_id || index}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="p-6 bg-dark-surface border border-dark-border rounded-xl hover:border-ifrit-red/30 transition-all group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: item.theme.color }} />
                          <span className="text-[9px] font-bold text-white/30 uppercase tracking-tighter">@{item.author}</span>
                        </div>
                        <span className="text-[10px] font-bold tracking-widest opacity-30 group-hover:opacity-100 transition-opacity" style={{ color: item.theme.color }}>
                          {item.theme.label}
                        </span>
                      </div>
                      <p className="text-text-on-dark-muted text-sm italic leading-relaxed group-hover:text-white transition-colors mb-4">
                        "{item.text}"
                      </p>
                      <div className="flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity pt-4 border-t border-white/5">
                        <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Confidence</span>
                        <span className="text-xs font-bold" style={{ color: item.theme.color }}>{item.analysis.confidence.toFixed(2)}%</span>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-2xl">
                    <p className="text-text-on-dark-muted italic">
                      {loading ? "Menghubungkan ke satelit X..." : "Belum ada data pencarian terdeteksi."}
                    </p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// Custom scrollbar styles
const scrollbarStyles = `
  .overflow-y-auto::-webkit-scrollbar {
    width: 6px;
  }
  .overflow-y-auto::-webkit-scrollbar-track {
    background: transparent;
  }
  .overflow-y-auto::-webkit-scrollbar-thumb {
    background: rgba(239, 68, 68, 0.2);
    border-radius: 10px;
  }
  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: rgba(239, 68, 68, 0.4);
  }
`;

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = scrollbarStyles;
  document.head.appendChild(style);
}
