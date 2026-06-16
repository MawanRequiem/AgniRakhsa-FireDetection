import { useState, useEffect } from 'react';
import CameraFeed from '@/components/cctv/CameraFeed';
import { SkeletonVideo } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { LayoutGrid, Maximize, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { customFetch } from '@/lib/api';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useUIStore } from '@/store/store';

export default function CCTVMonitor() {
  const [layout, setLayout] = useState('grid-4');
  const [cameras, setCameras] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCamera, setSelectedCamera] = useState(null);
  
  const connectWebSocket = useDashboardStore((state) => state.connectWebSocket);
  const language = useUIStore((s) => s.language);
  const isEn = language === 'en';

  useEffect(() => {
    // Ensure websocket is connected for live video 
    connectWebSocket();

    const fetchCameras = async () => {
      try {
        const response = await customFetch('/api/v1/cameras/');
        if (response.ok) {
          const data = await response.json();
          setCameras(data || []);
        }
      } catch (err) {
        console.error('Failed to fetch cameras:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCameras();
  }, []);

  const displayedCameras = layout === 'grid-4' ? cameras.slice(0, 4) : cameras;

  // Responsive tiling classes
  const gridClass = layout === 'grid-4'
    ? 'grid-cols-1 md:grid-cols-2'
    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--ifrit-text-primary)' }}>
            {isEn ? 'Live Video Surveillance' : 'Pemantauan Video Langsung'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ifrit-text-muted)' }}>
            {isEn ? 'Real-time views of all monitored zones.' : 'Tampilan langsung real-time dari seluruh zona yang dipantau.'}
          </p>
        </div>
        
        {/* Layout Controls */}
        <div className="flex items-center gap-2 p-1 rounded-md border" style={{ backgroundColor: 'var(--ifrit-bg-secondary)', borderColor: 'var(--ifrit-border)' }}>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 px-3 text-xs ${layout === 'grid-4' ? 'bg-[var(--ifrit-bg-tertiary)]' : ''}`}
            style={{ color: layout === 'grid-4' ? 'var(--ifrit-amber)' : 'var(--ifrit-text-secondary)' }}
            onClick={() => setLayout('grid-4')}
          >
            <LayoutGrid className="w-3.5 h-3.5 mr-1.5" /> 2×2
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 px-3 text-xs ${layout === 'grid-8' ? 'bg-[var(--ifrit-bg-tertiary)]' : ''}`}
            style={{ color: layout === 'grid-8' ? 'var(--ifrit-amber)' : 'var(--ifrit-text-secondary)' }}
            onClick={() => setLayout('grid-8')}
          >
            <Maximize className="w-3.5 h-3.5 mr-1.5" /> 4×2
          </Button>
        </div>
      </div>

      {/* Main Grid with elegant scrollability */}
      {isLoading ? (
        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-0">
          <div className={`grid gap-4 ${gridClass}`}>
            {[1, 2, 3, 4].map(i => (
              <SkeletonVideo key={i} showPlayIcon={false} delay={i * 0.1} />
            ))}
          </div>
        </div>
      ) : cameras.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border border-dashed rounded-xl bg-[var(--ifrit-bg-secondary)]" style={{ borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-muted)' }}>
          <Video className="w-12 h-12 mb-4 opacity-30 animate-pulse text-[var(--ifrit-brand)]" />
          <h2 className="text-md font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--ifrit-text-primary)' }}>
            {isEn ? 'No Cameras Connected' : 'Tidak Ada Kamera Tersambung'}
          </h2>
          <p className="text-xs opacity-70">
            {isEn ? 'No camera sources configured in this facility.' : 'Belum ada sumber kamera yang dikonfigurasi di fasilitas ini.'}
          </p>
          <p className="text-[10px] mt-1 opacity-50 font-mono">
            {isEn ? 'Configure nodes via device management.' : 'Konfigurasi node melalui manajemen perangkat.'}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-0">
          <div className={`grid gap-4 ${gridClass}`}>
            {displayedCameras.map(camera => (
              <div key={camera.id} className="aspect-video w-full">
                <CameraFeed 
                  camera={camera} 
                  onClick={() => setSelectedCamera(camera)} 
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expanded Camera Dialog - High-Tech Operator Deck */}
      <Dialog open={!!selectedCamera} onOpenChange={(open) => !open && setSelectedCamera(null)}>
        <DialogContent 
          className="w-[95vw] sm:max-w-none md:w-[90vw] md:max-w-6xl max-h-[90vh] lg:max-h-[80vh] flex flex-col p-0 border overflow-hidden rounded-xl shadow-2xl"
          style={{
            backgroundColor: 'var(--ifrit-bg-primary)',
            borderColor: 'var(--ifrit-border)'
          }}
        >
          <DialogTitle className="sr-only">Live Feed: {selectedCamera?.name}</DialogTitle>
          
          {selectedCamera && (
            <div className="flex flex-col lg:flex-row h-full lg:h-[70vh] min-h-0 lg:min-h-[500px]">
              {/* Left Column: Live Feed */}
              <div 
                className="w-full h-[250px] sm:h-[350px] lg:h-auto lg:flex-1 bg-black flex items-center justify-center relative p-2 border-b lg:border-b-0 lg:border-r"
                style={{ borderColor: 'var(--ifrit-border)' }}
              >
                {/* Live stream badge overlay */}
                <div className="absolute top-4 left-4 z-30 flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-zinc-800">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] font-bold tracking-widest text-zinc-200 uppercase font-mono">REC LIVE</span>
                </div>
                
                <div className="w-full h-full max-w-full max-h-full">
                  <CameraFeed camera={selectedCamera} />
                </div>
              </div>
              
              {/* Right Column: Console Details & Action Panel */}
              <div 
                className="flex-1 lg:flex-none lg:w-[350px] p-5 flex flex-col justify-between overflow-y-auto"
                style={{ backgroundColor: 'var(--ifrit-bg-secondary)' }}
              >
                <div className="space-y-6">
                  {/* Title & Room */}
                  <div>
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest font-mono">
                      {isEn ? 'CCTV Operator Deck' : 'Dek Operator CCTV'}
                    </span>
                    <h2 className="text-lg font-bold mt-1 tracking-tight" style={{ color: 'var(--ifrit-text-primary)' }}>{selectedCamera.name}</h2>
                    <div className="flex items-center gap-2 mt-2">
                      <span 
                        className="text-[10px] px-2 py-0.5 rounded border font-mono"
                        style={{
                          backgroundColor: 'var(--ifrit-bg-tertiary)',
                          borderColor: 'var(--ifrit-border)',
                          color: 'var(--ifrit-text-secondary)'
                        }}
                      >
                        {isEn ? 'Room ID' : 'ID Ruangan'}: {selectedCamera.room_id ? selectedCamera.room_id.slice(0, 8) : (isEn ? 'Unassigned' : 'Belum Ditetapkan')}
                      </span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border font-mono ${selectedCamera.status === 'online' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'}`}>
                        {selectedCamera.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Camera Telemetry Specs */}
                  <div className="space-y-3 border-t pt-4" style={{ borderColor: 'var(--ifrit-border)' }}>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--ifrit-text-muted)' }}>
                      {isEn ? 'Telemetry Status' : 'Status Telemetri'}
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2.5 border rounded" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)' }}>
                        <div className="text-[9px]" style={{ color: 'var(--ifrit-text-muted)' }}>FPS RATE</div>
                        <div className="font-bold mt-0.5" style={{ color: 'var(--ifrit-text-primary)' }}>25.4 FPS</div>
                      </div>
                      <div className="p-2.5 border rounded" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)' }}>
                        <div className="text-[9px]" style={{ color: 'var(--ifrit-text-muted)' }}>
                          {isEn ? 'LATENCY' : 'LATENSI'}
                        </div>
                        <div className="font-bold mt-0.5" style={{ color: 'var(--ifrit-text-primary)' }}>42 ms</div>
                      </div>
                      <div className="p-2.5 border rounded" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)' }}>
                        <div className="text-[9px]" style={{ color: 'var(--ifrit-text-muted)' }}>
                          {isEn ? 'RESOLUTION' : 'RESOLUSI'}
                        </div>
                        <div className="font-bold mt-0.5" style={{ color: 'var(--ifrit-text-primary)' }}>1280×720</div>
                      </div>
                      <div className="p-2.5 border rounded" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)' }}>
                        <div className="text-[9px]" style={{ color: 'var(--ifrit-text-muted)' }}>AI STREAM</div>
                        <div className="text-red-500 font-bold mt-0.5">YOLOv8s</div>
                      </div>
                    </div>
                  </div>

                  {/* Trigger History Logs */}
                  <div className="space-y-3 border-t pt-4" style={{ borderColor: 'var(--ifrit-border)' }}>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--ifrit-text-muted)' }}>
                      {isEn ? 'Trigger History' : 'Riwayat Pemicu'}
                    </h3>
                    <div className="space-y-1.5 font-mono text-[10px]" style={{ color: 'var(--ifrit-text-secondary)' }}>
                      <div className="flex justify-between items-center py-1 border-b" style={{ borderColor: 'var(--ifrit-border)' }}>
                        <span>[17:42:01] {isEn ? 'System Connected' : 'Sistem Terhubung'}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">OK</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b" style={{ borderColor: 'var(--ifrit-border)' }}>
                        <span>[17:43:55] {isEn ? 'Heat Threshold Checked' : 'Ambang Panas Diperiksa'}</span>
                        <span style={{ color: 'var(--ifrit-text-muted)' }}>NOMINAL</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b" style={{ borderColor: 'var(--ifrit-border)' }}>
                        <span>[17:45:10] {isEn ? 'AI Model Calibrated' : 'Model AI Dikalibrasi'}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">READY</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Operator Actions */}
                <div className="space-y-2 pt-6 border-t mt-6" style={{ borderColor: 'var(--ifrit-border)' }}>
                  <Button 
                    className="w-full text-xs font-mono font-bold tracking-wider py-2.5 bg-red-600 hover:bg-red-700 text-white rounded border-0 transition-colors"
                    onClick={() => {
                      alert(isEn 
                        ? `Manual override drill triggered for room: ${selectedCamera.room_id || 'unassigned'}`
                        : `Latihan pengabaian manual dipicu untuk ruangan: ${selectedCamera.room_id || 'belum ditetapkan'}`);
                    }}
                  >
                    {isEn ? 'TRIGGER MANUAL ALARM' : 'PICU ALARM MANUAL'}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full text-xs font-mono font-bold tracking-wider py-2.5 border bg-transparent hover:bg-[var(--ifrit-bg-tertiary)] hover:text-[var(--ifrit-text-primary)] rounded transition-all"
                    style={{
                      borderColor: 'var(--ifrit-border)',
                      color: 'var(--ifrit-text-secondary)'
                    }}
                    onClick={() => setSelectedCamera(null)}
                  >
                    {isEn ? 'CLOSE MONITOR PANEL' : 'TUTUP PANEL MONITOR'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

