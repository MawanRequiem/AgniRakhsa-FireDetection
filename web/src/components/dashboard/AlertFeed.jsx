import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { AlertCircle, Flame, Info, ShieldCheck } from 'lucide-react';
import PropTypes from 'prop-types';

export default function AlertFeed({ alerts }) {
  const shouldReduceMotion = useReducedMotion();

  if (!alerts || alerts.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center p-8 text-center rounded-md" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)' }}>
        <ShieldCheck className="mb-2 h-8 w-8 opacity-30" style={{ color: 'var(--ifrit-safe)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--ifrit-text-secondary)' }}>All systems nominal</p>
        <p className="text-xs mt-1" style={{ color: 'var(--ifrit-text-muted)' }}>No active incidents detected</p>
      </div>
    );
  }

  const getAlertIcon = (severity) => {
    switch (severity) {
      case 'critical': return <Flame className="h-4 w-4" style={{ color: 'var(--ifrit-fire)' }} />;
      case 'high': return <AlertCircle className="h-4 w-4" style={{ color: 'var(--ifrit-warning)' }} />;
      default: return <Info className="h-4 w-4" style={{ color: 'var(--ifrit-info)' }} />;
    }
  };

  const getAlertBg = (severity) => {
    switch (severity) {
      case 'critical': return { backgroundColor: 'rgba(239, 68, 68, 0.06)', borderColor: 'rgba(239, 68, 68, 0.2)' };
      case 'high': return { backgroundColor: 'rgba(245, 158, 11, 0.04)', borderColor: 'rgba(245, 158, 11, 0.15)' };
      default: return { backgroundColor: 'rgba(59, 130, 246, 0.04)', borderColor: 'rgba(59, 130, 246, 0.15)' };
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence>
        {alerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: shouldReduceMotion ? 0 : -10, height: shouldReduceMotion ? 'auto' : 0 }}
            animate={{ opacity: 1, x: 0, height: 'auto' }}
            exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.98 }}
            transition={{ duration: 0.15 }}
            className="flex items-start gap-3 border p-3 rounded-md"
            style={getAlertBg(alert.severity)}
          >
            <div className="mt-0.5 p-1 rounded border hidden sm:block" style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)' }}>
              {getAlertIcon(alert.severity)}
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium leading-tight" style={{ color: 'var(--ifrit-text-primary)' }}>
                {alert.message || `Alert: ${alert.severity}`}
              </p>
              <div className="flex items-center text-[11px] font-mono" style={{ color: 'var(--ifrit-text-muted)' }}>
                <span>{new Date(alert.created_at).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

AlertFeed.propTypes = {
  alerts: PropTypes.array
};
