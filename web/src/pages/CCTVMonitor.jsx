import React from "react";
import Sidebar from "../components/layout/Sidebar";
import { Video, VideoOff, Maximize2, AlertCircle } from "lucide-react";

const cameraList = [
  { id: 1, name: "Kamera 01 - Lab IoT", status: "Online", ip: "192.168.1.101" },
  {
    id: 2,
    name: "Kamera 02 - Koridor PNJ",
    status: "Online",
    ip: "192.168.1.102",
  },
  {
    id: 3,
    name: "Kamera 03 - Ruang Server",
    status: "Offline",
    ip: "192.168.1.103",
  },
];

const Camera = () => {
  return (
    <div className="flex bg-gray-950 min-h-screen text-white">
      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Monitoring Kamera (CCTV)</h1>
          <button className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 animate-pulse shadow-lg shadow-red-500/20">
            <AlertCircle size={20} /> PANIC BUTTON
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {cameraList.map((cam) => (
            <div
              key={cam.id}
              className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl"
            >
              {/* Camera Preview Area */}
              <div className="aspect-video bg-black flex items-center justify-center relative group">
                {cam.status === "Online" ? (
                  <div className="text-gray-700 group-hover:text-gray-500 transition cursor-pointer">
                    <Video size={64} />
                    <p className="text-xs mt-2 text-center">Live Feed Stream</p>
                  </div>
                ) : (
                  <div className="text-red-900 flex flex-col items-center">
                    <VideoOff size={64} />
                    <p className="text-sm mt-2 font-semibold">
                      Koneksi Terputus
                    </p>
                  </div>
                )}

                {/* Overlay Info */}
                <div className="absolute top-4 left-4 flex gap-2">
                  <span
                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                      cam.status === "Online"
                        ? "bg-green-500 text-black"
                        : "bg-red-600 text-white"
                    }`}
                  >
                    {cam.status}
                  </span>
                  <span className="bg-black/50 backdrop-blur-md px-2 py-1 rounded text-[10px] text-white">
                    {cam.ip}
                  </span>
                </div>
                <button className="absolute bottom-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg backdrop-blur-md opacity-0 group-hover:opacity-100 transition">
                  <Maximize2 size={18} />
                </button>
              </div>

              {/* Camera Footer */}
              <div className="p-4 flex justify-between items-center">
                <h3 className="font-medium text-gray-200">{cam.name}</h3>
                <div className="flex gap-2 text-xs">
                  <button className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-md transition text-gray-400">
                    Settings
                  </button>
                  <button className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-md transition text-gray-400">
                    Recordings
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Camera;
