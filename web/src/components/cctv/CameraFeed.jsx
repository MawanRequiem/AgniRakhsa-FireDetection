import { Maximize2, VideoOff } from 'lucide-react';
import StatusIndicator from '@/components/ui/StatusIndicator';

export default function CameraFeed({ camera, onClick }) {
  if (!camera) return null;

  return (
    <div
      className="relative rounded-md overflow-hidden border group cursor-pointer"
      style={{
        borderColor: camera.hasDetection ? 'var(--agni-fire)' : 'var(--agni-border)',
        minHeight: '200px',
        backgroundColor: 'var(--agni-bg-primary)',
      }}
      onClick={onClick}
    >
      {/* Video Placeholder (Grain Texture to simulate feed noise) */}
      {camera.status === 'online' ? (
        <div className="absolute inset-0 grain opacity-20" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--agni-text-muted)]">
          <VideoOff className="w-8 h-8 mb-2 opacity-50" />
          <span className="text-xs">Feed Offline</span>
        </div>
      )}

      {/* Overlays */}
      <div className="absolute inset-0 flex flex-col justify-between p-3 pointer-events-none">
        <div className="flex items-start justify-between">
          {/* Top Left: Name & Status */}
          <div className="flex items-center gap-2 bg-black/60 px-2 py-1 rounded backdrop-blur-sm">
            <StatusIndicator status={camera.status} size="sm" />
            <span className="text-xs font-medium text-white">{camera.name}</span>
          </div>

          {/* Top Right: Detection Badge */}
          {camera.hasDetection && (
            <div className="bg-[var(--agni-fire)] text-white text-[10px] font-bold px-2 py-1 rounded shadow-[0_0_10px_rgba(248,113,113,0.5)] animate-pulse">
              MOTION DETECTED
            </div>
          )}
        </div>

        {/* Bottom Right: Expand Icon */}
        <div className="self-end opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 p-1.5 rounded backdrop-blur-sm">
          <Maximize2 className="w-4 h-4 text-white" />
        </div>
      </div>

      {/* Detection bounding box placeholder */}
      {camera.hasDetection && (
        <div
          className="absolute border-2 border-[var(--agni-fire)] opacity-80"
          style={{
            top: '30%', left: '40%', width: '120px', height: '180px',
          }}
        >
          <div className="absolute -top-5 left-0 bg-[var(--agni-fire)] text-white text-[9px] px-1 font-mono">
            Person 98%
          </div>
        </div>
      )}
    </div>
  );
}
