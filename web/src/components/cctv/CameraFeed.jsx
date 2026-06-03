import { Maximize2, VideoOff } from 'lucide-react';
import StatusIndicator from '@/components/ui/StatusIndicator';
import { useDashboardStore } from '@/stores/useDashboardStore';

export default function CameraFeed({ camera, onClick, hideBorder = false }) {
  const cameraFrames = useDashboardStore((state) => state.cameraFrames);
  
  if (!camera) return null;

  // Get the latest frame for this camera from the store (with defensive checks for HMR)
  const safeCameraFrames = cameraFrames || {};
  const latestFrame = safeCameraFrames[camera.id];
  const hasLiveFrame = latestFrame && latestFrame.frame_b64;
  
  // Use either the camera's general state or the live state
  const isOnline = camera.status === 'online' || hasLiveFrame;
  const hasDetection = latestFrame ? latestFrame.max_confidence > 0.25 : camera.hasDetection;
  const isClickable = !!onClick;

  // Calculate live stream aspect ratio dynamically
  const width = latestFrame?.image_width || 640;
  const height = latestFrame?.image_height || 360;
  const streamAspectRatio = `${width} / ${height}`;

  return (
    <div
      className={`relative w-full h-full overflow-hidden flex items-center justify-center transition-all duration-300 ${
        isClickable ? 'cursor-pointer group hover:scale-[1.01]' : ''
      } ${hideBorder ? '' : 'border rounded-lg'}`}
      style={{
        borderColor: hasDetection ? 'var(--ifrit-fire)' : 'var(--ifrit-border)',
        backgroundColor: 'var(--ifrit-bg-primary)',
        boxShadow: hasDetection ? '0 0 15px rgba(239, 68, 68, 0.15)' : 'none',
      }}
      onClick={isClickable ? onClick : undefined}
    >
      {hasLiveFrame ? (
        // Inner aspect-locked wrapper for perfect bounding boxes alignment
        <div 
          className="relative flex items-center justify-center"
          style={{ 
            aspectRatio: streamAspectRatio,
            width: '100%',
            height: 'auto',
            maxWidth: '100%',
            maxHeight: '100%'
          }}
        >
          <img 
            src={`data:image/jpeg;base64,${latestFrame.frame_b64}`} 
            alt={`Live feed from ${camera.name}`}
            className="w-full h-full object-contain select-none"
          />

          {/* Real-time Bounding Boxes */}
          {latestFrame.detections && latestFrame.detections.length > 0 && (
             <div className="absolute inset-0 pointer-events-none">
               {latestFrame.detections.map((det, idx) => {
                  const left = (det.x1 / width) * 100;
                  const top = (det.y1 / height) * 100;
                  const boxWidth = ((det.x2 - det.x1) / width) * 100;
                  const boxHeight = ((det.y2 - det.y1) / height) * 100;
                  
                  const confidencePercent = Math.round(det.confidence * 100);

                  return (
                    <div
                      key={idx}
                      className="absolute border-2 border-[var(--ifrit-fire)] opacity-90 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                      style={{
                        top: `${top}%`,
                        left: `${left}%`,
                        width: `${boxWidth}%`,
                        height: `${boxHeight}%`,
                      }}
                    >
                      <div className="absolute -top-5 left-0 bg-[var(--ifrit-fire)] text-white text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-sm whitespace-nowrap uppercase tracking-wider">
                        {det.class_name} {confidencePercent}%
                      </div>
                    </div>
                  );
               })}
             </div>
          )}
        </div>
      ) : (
        // Offline / Connecting state
        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-[var(--ifrit-text-muted)] bg-[var(--ifrit-bg-secondary)]">
          {isOnline ? (
            <>
              <div className="absolute inset-0 grain opacity-10" />
              <div className="animate-pulse flex flex-col items-center justify-center">
                <VideoOff className="w-8 h-8 mb-2 opacity-40 text-[var(--ifrit-amber)]" />
                <span className="text-xs font-mono tracking-wider opacity-60">TUNING LIVE STREAM...</span>
              </div>
            </>
          ) : (
            <>
              <VideoOff className="w-8 h-8 mb-2 opacity-30" />
              <span className="text-xs font-mono tracking-wider opacity-50">FEED OFFLINE</span>
            </>
          )}
        </div>
      )}

      {/* Control overlay (HUD styles) */}
      <div className="absolute inset-0 flex flex-col justify-between p-3 pointer-events-none z-10 bg-gradient-to-b from-black/50 via-transparent to-black/30">
        <div className="flex items-start justify-between">
          {/* Top Left: Name & Status Badge */}
          <div className="flex items-center gap-2 bg-black/60 px-2.5 py-1 rounded backdrop-blur-sm border border-zinc-800/50">
            <StatusIndicator status={isOnline ? 'online' : 'offline'} size="sm" />
            <span className="text-[10px] font-bold font-mono text-white tracking-wider uppercase">{camera.name}</span>
          </div>

          {/* Top Right: Detection Banner */}
          {hasDetection && (
            <div className="bg-[var(--ifrit-fire)] text-white text-[9px] font-extrabold px-2.5 py-1 rounded shadow-[0_0_15px_rgba(239,68,68,0.6)] animate-pulse tracking-widest font-mono">
              THREAT ACTIVE
            </div>
          )}
        </div>

        {/* Bottom Right: Expand Action Icon */}
        {isClickable && (
          <div className="self-end opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/60 p-1.5 rounded backdrop-blur-sm border border-zinc-800/50">
            <Maximize2 className="w-3.5 h-3.5 text-white" />
          </div>
        )}
      </div>
    </div>
  );
}
