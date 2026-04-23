import React from 'react';
import Sidebar from '../components/layout/Sidebar';
import { Download, Search, Filter, Database as DbIcon } from 'lucide-react';

const sensorLogs = [
  { id: 1, date: '2026-04-23', time: '14:20:05', temp: '32.5°C', ph: '6.8', status: 'Aman' },
  { id: 2, date: '2026-04-23', time: '14:21:10', temp: '45.2°C', ph: '6.5', status: 'Waspada' },
  { id: 3, date: '2026-04-23', time: '14:22:15', temp: '85.0°C', ph: '5.2', status: 'Bahaya' },
];

const Database = () => {
  return (
    <div className="flex bg-gray-950 min-h-screen text-white">
      <main className="flex-1 p-8">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <DbIcon className="text-red-500" /> Database Sensor
            </h1>
            <p className="text-gray-400 text-sm mt-1">Kelola dan ekspor data historis monitoring.</p>
          </div>
          <button className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition text-sm font-semibold">
            <Download size={18} /> Ekspor ke CSV
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 text-gray-500" size={18} />
            <input type="text" placeholder="Cari lokasi atau status..." className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-red-500 outline-none" />
          </div>
          <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2 text-sm text-gray-300">
            <Filter size={18} /> Filter Tanggal
          </button>
        </div>

        {/* Table Area */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-gray-800 text-gray-400 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="p-4">ID</th>
                <th className="p-4">Tanggal</th>
                <th className="p-4">Waktu</th>
                <th className="p-4">Suhu</th>
                <th className="p-4">Nilai pH</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-800">
              {sensorLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-800/30 transition">
                  <td className="p-4 text-gray-500 font-mono">#{log.id}</td>
                  <td className="p-4">{log.date}</td>
                  <td className="p-4">{log.time}</td>
                  <td className="p-4 font-semibold">{log.temp}</td>
                  <td className="p-4">{log.ph}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                      log.status === 'Bahaya' ? 'bg-red-500/20 text-red-500 border border-red-500/50' :
                      log.status === 'Waspada' ? 'bg-orange-500/20 text-orange-500 border border-orange-500/50' :
                      'bg-green-500/20 text-green-500 border border-green-500/50'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 bg-gray-900 border-t border-gray-800 flex justify-between items-center text-xs text-gray-500">
            <p>Menampilkan 3 data terbaru</p>
            <div className="flex gap-2">
              <button className="px-3 py-1 bg-gray-800 rounded disabled:opacity-50">Prev</button>
              <button className="px-3 py-1 bg-gray-800 rounded">Next</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Database;