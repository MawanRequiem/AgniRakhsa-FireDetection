import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Activity,
  Cpu, Heart, Repeat2, Eye, Filter, Globe, Calendar,
  ArrowUpDown
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  Tooltip
} from 'recharts';
import { customFetch } from '@/lib/api';

const THEME = {
  negative: { color: '#ef4444', label: 'BAHAYA NYATA', bg: 'bg-red-500/10' },
  positive: { color: '#22c55e', label: 'AMAN/TERKENDALI', bg: 'bg-green-500/10' },
  netral: { color: '#94a3b8', label: 'AKTIVITAS RUTIN', bg: 'bg-slate-500/10' },
  konflik: { color: '#a855f7', label: 'VIRAL/ENGAGEMENT', bg: 'bg-purple-500/10' },
};

const SORT_OPTIONS = [
  { id: 'date-desc', label: 'Terbaru' },
  { id: 'date-asc', label: 'Terlama' },
  { id: 'confidence-desc', label: 'Confidence ↑' },
  { id: 'confidence-asc', label: 'Confidence ↓' },
];

const formatTweetDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date) + ' WIB';
  } catch { return dateStr; }
};

const relativeTime = (dateStr) => {
  if (!dateStr) return '';
  try {
    const now = new Date();
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Baru saja';
    if (diffMin < 60) return `${diffMin} menit lalu`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} jam lalu`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay} hari lalu`;
  } catch { return dateStr; }
};

const sortResults = (results, sortKey) => {
  const sorted = [...results];
  switch (sortKey) {
    case 'date-desc': return sorted.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    case 'date-asc': return sorted.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    case 'confidence-desc': return sorted.sort((a, b) => (b.analysis?.confidence || 0) - (a.analysis?.confidence || 0));
    case 'confidence-asc': return sorted.sort((a, b) => (a.analysis?.confidence || 0) - (b.analysis?.confidence || 0));
    default: return sorted;
  }
};

const mapLabelToKey = (rawLabel) => {
  const raw = String(rawLabel).toLowerCase().trim();
  if (raw.includes('neg')) return 'negative';
  if (raw.includes('pos')) return 'positive';
  if (raw.includes('neu')) return 'netral';
  if (raw.includes('con')) return 'konflik';
  return 'konflik';
};

const SortDropdown = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = SORT_OPTIONS.find(o => o.id === value) || SORT_OPTIONS[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-text-on-dark-muted hover:text-white hover:bg-white/5 border border-transparent hover:border-dark-border transition-all"
      >
        <ArrowUpDown size={12} />
        <span className="hidden sm:inline">{current.label}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-dark-surface border border-dark-border rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] p-1.5 space-y-0.5 z-50">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => { onChange(opt.id); setOpen(false); }}
              className={`w-full px-4 py-2.5 rounded-lg text-left text-xs font-bold uppercase tracking-wider transition-all ${
                value === opt.id
                  ? 'bg-ifrit-red/20 text-ifrit-red'
                  : 'text-text-on-dark-muted hover:text-white hover:bg-white/5'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function SentimenAnalisisX() {
  const [reportText, setReportText] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [liveStats, setLiveStats] = useState({ negative: 0, positive: 0, netral: 0, konflik: 0 });
  const [historyStats, setHistoryStats] = useState({ negative: 0, positive: 0, netral: 0, konflik: 0 });
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeMode, setActiveMode] = useState('x');
  const [searchQuery, setSearchQuery] = useState('kebakaran');
  const [xResults, setXResults] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filterProduct, setFilterProduct] = useState('Latest');
  const [filterLang, setFilterLang] = useState('');
  const [filterSince, setFilterSince] = useState('');
  const [filterUntil, setFilterUntil] = useState('');
  const [filterMinFaves, setFilterMinFaves] = useState('');
  const [filterCount, setFilterCount] = useState('20');
  const [historyResults, setHistoryResults] = useState([]);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const [sortBy, setSortBy] = useState('date-desc');
  const [liveSortBy, setLiveSortBy] = useState('date-desc');

  const liveResults = useMemo(() => {
    let results = [];
    if (activeMode === 'x' && xResults.length > 0) {
      results = xResults;
    } else if (activeMode === 'manual' && analysisResult) {
      results = [{
        tweet_id: 'manual-result',
        author: 'Operator',
        text: analysisResult.text,
        likes: 0, retweets: 0, views: 0,
        created_at: new Date().toISOString(),
        finalKey: mapLabelToKey(analysisResult.label),
        theme: THEME[mapLabelToKey(analysisResult.label)],
        source: 'manual',
        analysis: { label: analysisResult.label, confidence: analysisResult.confidence * 100 }
      }];
    }

    if (activeFilter !== 'all') {
      results = results.filter(item => item.finalKey === activeFilter);
    }

    return sortResults(results, liveSortBy);
  }, [xResults, analysisResult, activeFilter, activeMode, liveSortBy]);

  const sortedHistory = useMemo(() => {
    const filtered = historyResults.filter(item => {
      if (activeMode === 'manual') return item.source === 'manual';
      return item.source === 'x_crawl';
    });
    const byCategory = activeFilter === 'all' ? filtered : filtered.filter(item => item.finalKey === activeFilter);
    return sortResults(byCategory, sortBy);
  }, [historyResults, activeFilter, activeMode, sortBy]);

  const combinedStats = useMemo(() => ({
    negative: liveStats.negative + historyStats.negative,
    positive: liveStats.positive + historyStats.positive,
    netral: liveStats.netral + historyStats.netral,
    konflik: liveStats.konflik + historyStats.konflik,
  }), [liveStats, historyStats]);

  const chartData = useMemo(() => [
    { name: 'Negative', value: combinedStats.negative || 1, color: THEME.negative.color },
    { name: 'Positive', value: combinedStats.positive || 1, color: THEME.positive.color },
    { name: 'Netral', value: combinedStats.netral || 1, color: THEME.netral.color },
    { name: 'Konflik', value: combinedStats.konflik || 1, color: THEME.konflik.color },
  ], [combinedStats]);

  const maxStat = Math.max(combinedStats.negative, combinedStats.positive, combinedStats.netral, combinedStats.konflik, 1);

  const hasLiveResults = activeMode === 'x' ? xResults.length > 0 : analysisResult !== null;

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
        throw new Error(err.detail || 'Server error');
      }
      const data = await response.json();
      if (!data.label) throw new Error('Invalid response from server');
      const finalKey = mapLabelToKey(data.label);
      const confidence = data.confidence ? (data.confidence > 1 ? data.confidence / 100 : data.confidence) : 0;
      setAnalysisResult({
        text: reportText,
        label: finalKey.toUpperCase(),
        confidence,
        ...THEME[finalKey]
      });
      setLiveStats({ negative: 0, positive: 0, netral: 0, konflik: 0, [finalKey]: 1 });
      setReportText('');
      fetchHistory();
    } catch (error) {
      console.error('Error:', error);
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
    setLiveStats({ negative: 0, positive: 0, netral: 0, konflik: 0 });
    try {
      const params = new URLSearchParams();
      params.set('query', searchQuery);
      params.set('count', filterCount);
      params.set('product', filterProduct);
      if (filterLang) params.set('lang', filterLang);
      if (filterSince) params.set('since', filterSince);
      if (filterUntil) params.set('until', filterUntil);
      if (filterMinFaves) params.set('min_faves', filterMinFaves);

      const response = await customFetch(`/api/v1/nlp/analyze-x?${params.toString()}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Gagal mengambil data X');
      }
      const res = await response.json();
      if (res.status === 'success') {
        const newStats = { negative: 0, positive: 0, netral: 0, konflik: 0 };
        const mappedResults = res.data.map(item => {
          const finalKey = mapLabelToKey(item.analysis.label);
          newStats[finalKey]++;
          return { ...item, theme: THEME[finalKey], finalKey };
        });
        setXResults(mappedResults);
        setLiveStats(newStats);
      }
    } catch (error) {
      console.error('X Search Error:', error);
    } finally {
      setLoading(false);
      fetchHistory();
    }
  };

  const fetchHistory = async () => {
    setFetchingHistory(true);
    try {
      const response = await customFetch('/api/v1/nlp/history?limit=100');
      if (!response.ok) {
        console.warn('History endpoint tidak tersedia, skip.');
        return;
      }
      const res = await response.json();
      if (!res.data || res.data.length === 0) return;

      const histStats = { negative: 0, positive: 0, netral: 0, konflik: 0 };
      const mapped = res.data.map(item => {
        const label = item.sentiment_label || 'konflik';
        const uiKey = label === 'conflict' ? 'konflik' : label;
        if (uiKey in histStats) histStats[uiKey]++;
        return {
          tweet_id: item.id,
          author: item.tweet_author || 'User',
          text: item.original_text,
          likes: item.tweet_likes || 0,
          retweets: item.tweet_retweets || 0,
          views: item.tweet_views || 0,
          created_at: item.tweet_created_at || item.created_at || '',
          finalKey: uiKey,
          theme: THEME[uiKey] || THEME.konflik,
          source: item.source,
          analysis: {
            label: (uiKey).toUpperCase(),
            confidence: (item.confidence || 0) * 100
          }
        };
      });
      setHistoryResults(mapped);
      setHistoryStats(histStats);
    } catch (error) {
      console.warn('Fetch History unavailable:', error.message);
    } finally {
      setFetchingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const SeverityBar = ({ color, label, count }) => (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out-expo"
          style={{ backgroundColor: color, width: `${(count / maxStat) * 100}%` }}
        />
      </div>
      <span className="text-[11px] font-bold uppercase tracking-wider text-white/60 w-28 text-right shrink-0">{label}</span>
      <span className="text-sm font-mono font-bold text-white w-8 text-right shrink-0">{count}</span>
    </div>
  );

  const ResultCard = ({ item, showRelative = false }) => (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className={`p-5 rounded-xl border border-dark-border ${item.theme.bg} hover:border-white/10 transition-colors`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="shrink-0 w-2.5 h-2.5 rounded-full shadow-[0_0_6px]"
            style={{ backgroundColor: item.theme.color, boxShadow: `0 0 8px ${item.theme.color}40` }}
          />
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-white/60 uppercase tracking-tight truncate">
              @{item.author}
            </p>
            {showRelative && item.created_at && (
              <p className="text-[10px] text-white/30 mt-0.5">{relativeTime(item.created_at)}</p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 ml-4">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-60" style={{ color: item.theme.color }}>
            {item.theme.label}
          </p>
          <p className="text-lg font-mono font-bold" style={{ color: item.theme.color }}>
            {item.analysis.confidence.toFixed(1)}%
          </p>
        </div>
      </div>

      <p className="text-sm text-white/75 italic leading-relaxed mb-3 line-clamp-3">
        &ldquo;{item.text}&rdquo;
      </p>

      {!showRelative && item.created_at && (
        <div className="flex items-center gap-1 text-[10px] text-white/35 font-medium mb-2">
          <Calendar size={10} />
          <span>{formatTweetDate(item.created_at)}</span>
        </div>
      )}

      {(item.likes > 0 || item.retweets > 0 || item.views > 0) && (
        <div className="flex items-center gap-3 text-white/25 text-[10px] font-bold">
          {item.likes > 0 && <span className="flex items-center gap-1"><Heart size={10} />{item.likes}</span>}
          {item.retweets > 0 && <span className="flex items-center gap-1"><Repeat2 size={10} />{item.retweets}</span>}
          {item.views > 0 && <span className="flex items-center gap-1"><Eye size={10} />{item.views.toLocaleString()}</span>}
        </div>
      )}
    </motion.div>
  );

  const ResultCardSimple = ({ item }) => (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className={`p-5 rounded-xl border border-dark-border ${item.theme.bg} hover:border-white/10 transition-colors`}
    >
      <div className="flex justify-between items-start mb-3">
        <span
          className="shrink-0 w-2.5 h-2.5 rounded-full shadow-[0_0_6px] mt-1"
          style={{ backgroundColor: item.theme.color, boxShadow: `0 0 8px ${item.theme.color}40` }}
        />
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: item.theme.color }}>
            {item.theme.label}
          </p>
        </div>
      </div>
      <p className="text-base text-white/80 italic leading-relaxed mb-4">
        &ldquo;{item.text}&rdquo;
      </p>
      <div className="flex justify-between items-end">
        <div className="flex items-center gap-2 text-white/40">
          <Cpu size={12} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Bi-LSTM</span>
        </div>
        <span className="text-xl font-mono font-bold" style={{ color: item.theme.color }}>
          {(item.analysis.confidence).toFixed(2)}%
        </span>
      </div>
    </motion.div>
  );

  return (
    <div className="section-dark min-h-screen pt-28 pb-20">
      <div className="container-wide">

        {/* ===== COMMAND BAR ===== */}
        <div className="mb-12">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-display font-bold text-white leading-tight">
                SENTIMEN <span className="text-ifrit-red">ANALISIS X</span>
              </h1>
              <p className="text-text-on-dark-muted text-sm mt-2">
                Validasi laporan kebakaran secara instan menggunakan arsitektur Bi-LSTM.
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl border border-white/10 shrink-0">
              <button
                onClick={() => { setActiveMode('x'); setAnalysisResult(null); setXResults([]); setLiveStats({ negative: 0, positive: 0, netral: 0, konflik: 0 }); }}
                className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                  activeMode === 'x'
                    ? 'bg-ifrit-red text-white'
                    : 'text-text-on-dark-muted hover:text-white hover:bg-white/5'
                }`}
              >
                X Crawl
              </button>
              <button
                onClick={() => { setActiveMode('manual'); setAnalysisResult(null); setXResults([]); setLiveStats({ negative: 0, positive: 0, netral: 0, konflik: 0 }); }}
                className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                  activeMode === 'manual'
                    ? 'bg-ifrit-red text-white'
                    : 'text-text-on-dark-muted hover:text-white hover:bg-white/5'
                }`}
              >
                Manual
              </button>
            </div>
          </div>
        </div>

        {/* ===== CONTENT: FORM + SIDEBAR ===== */}
        <div className="grid lg:grid-cols-12 gap-10 items-start mb-16">
          {/* FORM */}
          <div className="lg:col-span-7">
            {activeMode === 'manual' ? (
              <form onSubmit={handleAnalyze} className="bg-dark-surface border border-dark-border p-6 rounded-2xl space-y-5">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-text-on-dark-muted">Input Laporan Terkini</h3>
                <textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="Ceritakan kejadian... (Contoh: Ada api menyambar kabel di Lab Elektro PNJ)"
                  className="w-full h-40 bg-dark-bg border border-dark-border rounded-xl p-5 text-base focus:ring-2 focus:ring-ifrit-red outline-none transition-all resize-none text-white placeholder:text-white/20"
                />
                <button
                  type="submit"
                  disabled={loading || !reportText.trim()}
                  className="w-full py-4 bg-ifrit-red hover:bg-ifrit-red-light disabled:opacity-40 rounded-xl font-display font-bold text-sm text-white transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    'PROSES ALGORITMA...'
                  ) : (
                    <><Send size={18} /> ANALISIS SEKARANG</>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSearchX} className="bg-dark-surface border border-dark-border p-6 rounded-2xl space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-text-on-dark-muted">Keyword Search Twitter/X</h3>
                  <button
                    type="button"
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-text-on-dark-muted hover:text-ifrit-red transition-colors uppercase tracking-wider"
                  >
                    <Filter size={13} />
                    Filter
                  </button>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Masukkan kata kunci... (kebakaran, asap, api)"
                  className="w-full bg-dark-bg border border-dark-border rounded-xl py-4 px-5 text-base focus:ring-2 focus:ring-ifrit-red outline-none transition-all text-white placeholder:text-white/20"
                />

                {showFilters && (
                  <div className="grid grid-cols-2 gap-4 p-5 bg-dark-bg rounded-xl border border-dark-border">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-text-on-dark-muted uppercase tracking-wider flex items-center gap-1"><Globe size={10} />Bahasa</label>
                      <select value={filterLang} onChange={(e) => setFilterLang(e.target.value)} className="w-full bg-dark-surface border border-dark-border rounded-lg py-2.5 px-3 text-sm text-white outline-none focus:ring-1 focus:ring-ifrit-red">
                        <option value="">Semua</option>
                        <option value="id">Indonesia</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-text-on-dark-muted uppercase tracking-wider">Sorting</label>
                      <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} className="w-full bg-dark-surface border border-dark-border rounded-lg py-2.5 px-3 text-sm text-white outline-none focus:ring-1 focus:ring-ifrit-red">
                        <option value="Latest">Terbaru</option>
                        <option value="Top">Populer</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-text-on-dark-muted uppercase tracking-wider flex items-center gap-1"><Calendar size={10} />Dari Tanggal</label>
                      <input type="date" value={filterSince} onChange={(e) => setFilterSince(e.target.value)} className="w-full bg-dark-surface border border-dark-border rounded-lg py-2.5 px-3 text-sm text-white outline-none focus:ring-1 focus:ring-ifrit-red" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-text-on-dark-muted uppercase tracking-wider flex items-center gap-1"><Calendar size={10} />Sampai Tanggal</label>
                      <input type="date" value={filterUntil} onChange={(e) => setFilterUntil(e.target.value)} className="w-full bg-dark-surface border border-dark-border rounded-lg py-2.5 px-3 text-sm text-white outline-none focus:ring-1 focus:ring-ifrit-red" />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[10px] font-bold text-text-on-dark-muted uppercase tracking-wider flex items-center gap-1"><Heart size={10} />Min. Likes</label>
                      <input type="number" min="0" value={filterMinFaves} onChange={(e) => setFilterMinFaves(e.target.value)} placeholder="0" className="w-full bg-dark-surface border border-dark-border rounded-lg py-2.5 px-3 text-sm text-white outline-none focus:ring-1 focus:ring-ifrit-red" />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[10px] font-bold text-text-on-dark-muted uppercase tracking-wider">Jumlah Tweet</label>
                      <div className="relative">
                        <input
                          type="number" min="1" max="200"
                          value={filterCount}
                          onChange={(e) => setFilterCount(e.target.value)}
                          className="w-full bg-dark-surface border border-dark-border rounded-lg py-2.5 px-3 text-sm text-white outline-none focus:ring-1 focus:ring-ifrit-red"
                          placeholder="35"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/20 font-bold uppercase">Tweets</span>
                      </div>
                      <p className="text-[10px] text-text-on-dark-muted leading-tight">Makin banyak tweet, makin lama proses analisis AI Bi-LSTM (Max: 200).</p>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !searchQuery.trim()}
                  className="w-full py-4 bg-ifrit-red hover:bg-ifrit-red-light disabled:opacity-40 rounded-xl font-display font-bold text-sm text-white transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    'MENGUMPULKAN DATA...'
                  ) : (
                    <><Activity size={18} /> MULAI PENCARIAN & ANALISIS</>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* SIDEBAR: Pie + Severity Bars */}
          <div className="lg:col-span-5">
            <div className="bg-dark-surface border border-dark-border p-6 rounded-2xl">
              <div className="h-[240px] w-full mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%" cy="50%"
                      innerRadius={65} outerRadius={95}
                      dataKey="value"
                      paddingAngle={6}
                      stroke="none"
                    >
                      {chartData.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#171B24', border: 'none', borderRadius: '12px', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {Object.entries(THEME).map(([key, config]) => (
                  <SeverityBar key={key} color={config.color} label={config.label} count={combinedStats[key]} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ===== LIVE RESULTS ZONE ===== */}
        {hasLiveResults && (
          <section className="mb-16">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-dark-border">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-ifrit-red animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-ifrit-red">Hasil Pencarian Langsung</span>
                </span>
                <span className="text-[10px] font-bold text-white/25 bg-white/5 px-2 py-0.5 rounded-full uppercase tracking-wider">Baru</span>
              </div>
              <SortDropdown value={liveSortBy} onChange={setLiveSortBy} />
            </div>

            {/* Live severity strip */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {Object.entries(THEME).map(([key, config]) => (
                <div key={key} className="p-3 rounded-lg border border-white/5" style={{ backgroundColor: `${config.color}10` }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-white/50">{config.label}</p>
                  <p className="text-2xl font-mono font-bold" style={{ color: config.color }}>{liveStats[key]}</p>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {liveResults.map((item, idx) => (
                  <ResultCard key={item.tweet_id || idx} item={item} />
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* ===== HISTORY ZONE ===== */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-dark-border">
            <h2 className="text-lg font-display font-bold text-white">
              Riwayat <span className="text-text-on-dark-muted">Analisis</span>
            </h2>
            <div className="flex items-center gap-3">
              <SortDropdown value={sortBy} onChange={setSortBy} />
              <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg border border-white/10">
                {['all', 'negative', 'positive', 'netral', 'konflik'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                      activeFilter === f
                        ? 'bg-ifrit-red text-white'
                        : 'text-text-on-dark-muted hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {f === 'all' ? 'Semua' : THEME[f]?.label || f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {fetchingHistory ? (
            <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-2xl">
              <p className="text-text-on-dark-muted">Menghubungkan ke pusat data...</p>
            </div>
          ) : sortedHistory.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              <AnimatePresence mode="popLayout">
                {sortedHistory.map((item, idx) => (
                  <ResultCard key={item.tweet_id || idx} item={item} showRelative />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-2xl">
              <p className="text-text-on-dark-muted">Belum ada riwayat analisis yang tersimpan.</p>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
