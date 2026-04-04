import { useState, useEffect } from 'react';
import CameraFeed from '@/components/cctv/CameraFeed';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { LayoutGrid, Maximize, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { customFetch } from '@/lib/api';

export default function CCTVMonitor() {
  const [layout, setLayout] = useState('grid-4');
  const [cameras, setCameras] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCamera, setSelectedCamera] = useState(null);

  useEffect(() => {
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

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--agni-text-primary)' }}>Live CCTV Monitor</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--agni-text-muted)' }}>Real-time surveillance feeds across the facility.</p>
        </div>
        
        {/* Layout Controls */}
        <div className="flex items-center gap-2 p-1 rounded-md border" style={{ backgroundColor: 'var(--agni-bg-secondary)', borderColor: 'var(--agni-border)' }}>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 px-3 text-xs ${layout === 'grid-4' ? 'bg-[var(--agni-bg-tertiary)]' : ''}`}
            style={{ color: layout === 'grid-4' ? 'var(--agni-amber)' : 'var(--agni-text-secondary)' }}
            onClick={() => setLayout('grid-4')}
          >
            <LayoutGrid className="w-3.5 h-3.5 mr-1.5" /> 2×2
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 px-3 text-xs ${layout === 'grid-8' ? 'bg-[var(--agni-bg-tertiary)]' : ''}`}
            style={{ color: layout === 'grid-8' ? 'var(--agni-amber)' : 'var(--agni-text-secondary)' }}
            onClick={() => setLayout('grid-8')}
          >
            <Maximize className="w-3.5 h-3.5 mr-1.5" /> 4×2
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      {isLoading ? (
        <div className="flex-1 grid gap-4 auto-rows-fr" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-md border animate-pulse" style={{ backgroundColor: 'var(--agni-bg-tertiary)', borderColor: 'var(--agni-border)' }} />
          ))}
        </div>
      ) : cameras.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl" style={{ borderColor: 'var(--agni-border)', color: 'var(--agni-text-muted)' }}>
          <Video className="w-12 h-12 mb-4 opacity-30" />
          <h2 className="text-lg font-bold uppercase tracking-wider mb-2">CCTV Integration Pending</h2>
          <p className="text-sm font-mono opacity-70">No camera sources configured.</p>
          <p className="text-xs font-mono mt-1 opacity-50">Register cameras via POST /api/v1/cameras/</p>
        </div>
      ) : (
        <div 
          className="flex-1 grid gap-4 auto-rows-fr"
          style={{ 
            gridTemplateColumns: layout === 'grid-4' ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))' 
          }}
        >
          {displayedCameras.map(camera => (
             <CameraFeed 
               key={camera.id} 
               camera={camera} 
               onClick={() => setSelectedCamera(camera)} 
             />
          ))}
        </div>
      )}

      {/* Expanded Camera Dialog */}
      <Dialog open={!!selectedCamera} onOpenChange={(open) => !open && setSelectedCamera(null)}>
        <DialogContent 
          className="max-w-5xl w-[90vw] p-0 border-0 bg-black overflow-hidden"
        >
          <DialogTitle className="sr-only">Live Feed: {selectedCamera?.name}</DialogTitle>
          {selectedCamera && (
            <div className="relative w-full aspect-video">
              <CameraFeed camera={selectedCamera} onClick={() => {}} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
