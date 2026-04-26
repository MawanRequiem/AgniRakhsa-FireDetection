import { Info } from 'lucide-react';

export default function HoverClue({ text }) {
  return (
    <div className="relative group inline-flex items-center justify-center ml-2 cursor-help">
      {/* Icon Trigger */}
      <div 
        className="w-5 h-5 rounded-full flex items-center justify-center transition-colors group-hover:bg-[rgba(59,130,246,0.15)]"
        style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
      >
        <Info className="w-3.5 h-3.5" style={{ color: 'var(--ifrit-info)' }} />
        <span className="sr-only">More info</span>
      </div>
      
      {/* Tooltip Content */}
      <div 
        className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 opacity-0 transition-opacity duration-200 group-hover:opacity-100 z-50 p-3 text-sm rounded-lg shadow-md border"
        style={{ 
          backgroundColor: 'var(--ifrit-bg-primary)', 
          borderColor: 'var(--ifrit-border)',
          color: 'var(--ifrit-text-primary)'
        }}
      >
        {text}
        {/* Tooltip Arrow */}
        <div 
          className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent"
          style={{ borderBottomColor: 'var(--ifrit-border)', marginBottom: '-1px' }}
        />
        <div 
          className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent"
          style={{ borderBottomColor: 'var(--ifrit-bg-primary)', marginBottom: '-2px' }}
        />
      </div>
    </div>
  );
}
