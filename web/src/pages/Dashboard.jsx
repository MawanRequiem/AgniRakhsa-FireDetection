import React, { useState } from "react";
import {
  Users,
  Activity,
  ShieldAlert,
  Clock,
  Filter,
  Thermometer,
} from "lucide-react";

const Dashboard = () => {
  // 1. State untuk memfilter data berdasarkan status (Aman, Waspada, Bahaya)
  const [filterStatus, setFilterStatus] = useState("Semua");

  // 2. Data dummy (Nantinya data ini akan diambil dari Supabase/Backend)
  const detectionLogs = [
    {
      id: 1,
      time: "14:20:05",
      date: "23 Apr 2026",
      status: "Bahaya",
      temp: "85°C",
      img: "Kebakaran Lab",
    },
    {
      id: 2,
      time: "14:15:00",
      date: "23 Apr 2026",
      status: "Waspada",
      temp: "42°C",
      img: "Asap Terdeteksi",
    },
    {
      id: 3,
      time: "13:50:22",
      date: "23 Apr 2026",
      status: "Aman",
      temp: "31°C",
      img: "Kondisi Normal",
    },
    {
      id: 4,
      time: "13:30:10",
      date: "23 Apr 2026",
      status: "Aman",
      temp: "30°C",
      img: "Kondisi Normal",
    },
  ];

  // 3. Logika Filtering
  const filteredData =
    filterStatus === "Semua"
      ? detectionLogs
      : detectionLogs.filter((item) => item.status === filterStatus);

  return (
      <main className="flex-1 p-8">
        {/* Header Section: Judul dan Jam Real-time */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard AgniRakhsa</h1>
            <p className="text-gray-400 mt-1">
              Sistem Pemantauan Api Berbasis AI & IoT (PBL PNJ)
            </p>
          </div>
          <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 p-3 rounded-xl shadow-inner">
            <Clock size={20} className="text-red-500" />
            <span className="text-sm font-mono tracking-wider">
              {new Date().toLocaleTimeString()} | {new Date().toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Top Highlight Cards: Ringkasan Cepat */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 flex items-center gap-4 shadow-lg hover:border-blue-500/50 transition">
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase font-bold">Sensor Aktif</p>
              <h2 className="text-2xl font-bold">12 Node</h2>
            </div>
          </div>

          <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 flex items-center gap-4 shadow-lg hover:border-red-500/50 transition">
            <div className="p-3 bg-red-500/10 text-red-500 rounded-xl">
              <ShieldAlert size={24} />
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase font-bold">Total Deteksi</p>
              <h2 className="text-2xl font-bold">{detectionLogs.length} Gambar</h2>
            </div>
          </div>

          <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 flex items-center gap-4 shadow-lg hover:border-green-500/50 transition">
            <div className="p-3 bg-green-500/10 text-green-500 rounded-xl">
              <Users size={24} />
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase font-bold">Admin Online</p>
              <h2 className="text-2xl font-bold">1 Aktif</h2>
            </div>
          </div>

          <div className="bg-red-600 p-6 rounded-2xl flex items-center gap-4 shadow-xl shadow-red-900/40 transform hover:scale-105 transition">
            <div className="p-3 bg-white/20 text-white rounded-xl shadow-inner">
              <Thermometer size={24} />
            </div>
            <div>
              <p className="text-red-100 text-xs uppercase font-bold tracking-wider">Suhu Tertinggi</p>
              <h2 className="text-2xl font-bold text-white">85°C</h2>
            </div>
          </div>
        </div>

        {/* Filter Section: Memilih status yang ingin dilihat */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-400 mr-2 uppercase tracking-widest font-bold text-[10px]">
            <Filter size={16} /> Filter Status:
          </div>
          {["Semua", "Aman", "Waspada", "Bahaya"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 ${
                filterStatus === status
                  ? "bg-red-600 text-white shadow-lg shadow-red-900/40 border border-red-500"
                  : "bg-gray-900 text-gray-500 border border-gray-800 hover:border-gray-600 hover:text-gray-300"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* List Deteksi Gambar & Sensor (Feed) */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {filteredData.map((log) => (
            <div
              key={log.id}
              className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden flex items-stretch hover:border-red-500/50 transition-all duration-300 group shadow-lg"
            >
              {/* Bagian Thumbnail (AI Visual) */}
              <div className="w-32 md:w-40 bg-black flex flex-col items-center justify-center p-4 text-center border-r border-gray-800">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-colors ${log.status === 'Bahaya' ? 'bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-gray-800'}`}>
                  <ShieldAlert
                    className={log.status === "Bahaya" ? "text-red-500" : "text-gray-600"}
                    size={24}
                  />
                </div>
                <span className="text-[9px] text-gray-600 font-mono uppercase tracking-widest">
                  AI_SNAPSHOT
                </span>
              </div>

              {/* Bagian Detail Informasi */}
              <div className="flex-1 p-6 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg group-hover:text-red-500 transition-colors">{log.img}</h3>
                    <p className="text-gray-500 text-[10px] uppercase font-mono tracking-wider flex items-center gap-1.5 mt-1">
                      <Clock size={12} /> {log.date} | {log.time}
                    </p>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${
                      log.status === "Bahaya"
                        ? "bg-red-500/10 text-red-500 border-red-500/30"
                        : log.status === "Waspada"
                        ? "bg-orange-500/10 text-orange-500 border-orange-500/30"
                        : "bg-green-500/10 text-green-500 border-green-500/30"
                    }`}
                  >
                    {log.status}
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-6">
                  <div className="flex items-center gap-2 bg-gray-800/50 px-3 py-1.5 rounded-lg border border-gray-700/50">
                    <Thermometer size={16} className="text-orange-500" />
                    <span className="text-sm font-mono font-bold">{log.temp}</span>
                  </div>
                  <div className="h-4 w-px bg-gray-800"></div>
                  <button className="text-[10px] tracking-widest uppercase text-red-500 hover:text-red-400 font-black transition-colors">
                    [ ANALYZE_DETAIL ]
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Empty State: Jika filter tidak menemukan data */}
          {filteredData.length === 0 && (
            <div className="col-span-full py-24 text-center bg-gray-900/50 rounded-3xl border-2 border-dashed border-gray-800 shadow-inner">
              <ShieldAlert size={48} className="mx-auto text-gray-800 mb-4" />
              <p className="text-gray-600 font-bold uppercase tracking-widest text-sm">
                Sistem Nominal: Tidak ada anomali "{filterStatus}"
              </p>
            </div>
          )}
        </div>
      </main>
  );
};

export default Dashboard;