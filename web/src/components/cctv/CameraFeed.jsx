import { Maximize2, VideoOff } from 'lucide-react';
import StatusIndicator from '@/components/ui/StatusIndicator';
import { useDashboardStore } from '@/stores/useDashboardStore';

export default function CameraFeed({ camera, onClick }) {
  const cameraFrames = useDashboardStore((state) => state.cameraFrames);
  
  if (!camera) return null;

  // Get the latest frame for this camera from the store (with defensive checks for HMR)
  const safeCameraFrames = cameraFrames || {};
  const latestFrame = safeCameraFrames[camera.id];
  const hasLiveFrame = latestFrame && latestFrame.frame_b64;
  
  // Use either the camera's general state or the live state
  const isOnline = camera.status === 'online' || hasLiveFrame;
  const hasDetection = latestFrame ? latestFrame.max_confidence > 0.25 : camera.hasDetection;

  return (
    <div
      className="relative rounded-md overflow-hidden border group cursor-pointer"
      style={{
        borderColor: hasDetection ? 'var(--ifrit-fire)' : 'var(--ifrit-border)',
        minHeight: '200px',
        backgroundColor: 'var(--ifrit-bg-primary)',
      }}
      onClick={onClick}
    >
      {/* Video Stream or Placeholder */}
      {hasLiveFrame ? (
        <img 
          src={`data:image/jpeg;base64,${latestFrame.frame_b64}`} 
          alt={`Live feed from ${camera.name}`}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : isOnline ? (
        <div className="absolute inset-0 grain opacity-20" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--ifrit-text-muted)]">
          <VideoOff className="w-8 h-8 mb-2 opacity-50" />
          <span className="text-xs">Feed Offline</span>
        </div>
      )}

      {/* Overlays */}
      <div className="absolute inset-0 flex flex-col justify-between p-3 pointer-events-none">
        <div className="flex items-start justify-between">
          {/* Top Left: Name & Status */}
          <div className="flex items-center gap-2 bg-black/60 px-2 py-1 rounded backdrop-blur-sm">
            <StatusIndicator status={isOnline ? 'online' : 'offline'} size="sm" />
            <span className="text-xs font-medium text-white">{camera.name}</span>
          </div>

          {/* Top Right: Detection Badge */}
          {hasDetection && (
            <div className="bg-[var(--ifrit-fire)] text-white text-[10px] font-bold px-2 py-1 rounded shadow-[0_0_10px_rgba(248,113,113,0.5)] animate-pulse">
              MOTION DETECTED
            </div>
          )}
        </div>

        {/* Bottom Right: Expand Icon */}
        <div className="self-end opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 p-1.5 rounded backdrop-blur-sm">
          <Maximize2 className="w-4 h-4 text-white" />
        </div>
      </div>

      {/* Real-time Bounding Boxes */}
      {hasLiveFrame && latestFrame.detections && latestFrame.detections.length > 0 && (
         <div className="absolute inset-0 pointer-events-none">
           {latestFrame.detections.map((det, idx) => {
              // Convert absolute coordinates to percentages
              const width = latestFrame.image_width || 640;
              const height = latestFrame.image_height || 480;
              
              const left = (det.x1 / width) * 100;
              const top = (det.y1 / height) * 100;
              const boxWidth = ((det.x2 - det.x1) / width) * 100;
              const boxHeight = ((det.y2 - det.y1) / height) * 100;
              
              const confidencePercent = Math.round(det.confidence * 100);

              return (
                <div
                  key={idx}
                  className="absolute border-2 border-[var(--ifrit-fire)] opacity-80"
                  style={{
                    top: `${top}%`,
                    left: `${left}%`,
                    width: `${boxWidth}%`,
                    height: `${boxHeight}%`,
                  }}
                >
                  <div className="absolute -top-5 left-0 bg-[var(--ifrit-fire)] text-white text-[10px] px-1 font-mono whitespace-nowrap">
                    {det.class_name} {confidencePercent}%
                  </div>
                </div>
              );
           })}
         </div>
      )}
    </div>
  );
}
