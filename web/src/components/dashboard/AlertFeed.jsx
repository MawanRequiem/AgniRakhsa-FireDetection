import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Flame, Info, ShieldAlert } from 'lucide-react';
import PropTypes from 'prop-types';

export default function AlertFeed({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center border border-dashed border-[var(--agni-border)] bg-[var(--agni-bg-tertiary)] p-8 text-center">
        <ShieldAlert className="mb-2 h-8 w-8 text-muted-foreground/50 opacity-80" />
        <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Systems Nominal</p>
        <p className="text-xs text-muted-foreground/70 font-mono mt-1">NO_ACTIVE_ANOMALIES_DETECTED</p>
      </div>
    );
  }

  const getAlertIcon = (severity) => {
    switch (severity) {
      case 'critical': return <Flame className="h-4 w-4 text-red-500" />;
      case 'high': return <AlertCircle className="h-4 w-4 text-amber-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getAlertColor = (severity) => {
    switch (severity) {
      case 'critical': return 'border-red-500/80 bg-red-500/10 text-red-700 dark:text-red-400';
      case 'high': return 'border-amber-500/50 bg-amber-500/5 text-amber-700 dark:text-amber-400';
      default: return 'border-blue-500/50 bg-blue-500/5 text-blue-700 dark:text-blue-400';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence>
        {alerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: -10, height: 0 }}
            animate={{ opacity: 1, x: 0, height: 'auto' }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={`flex items-start gap-3 border p-3 card-shadow ${getAlertColor(alert.severity)}`}
          >
            <div className="mt-0.5 bg-[var(--agni-bg-primary)] p-1 border border-[var(--agni-border)] hidden sm:block">
              {getAlertIcon(alert.severity)}
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-semibold tracking-tight leading-none uppercase">
                {alert.message || `Risk Detected: LVL-${alert.severity.toUpperCase()}`}
              </p>
              <div className="flex items-center text-[11px] font-mono opacity-80 pt-1">
                <span>{new Date(alert.created_at).toISOString().replace('T', ' ').substring(0, 19)}</span>
                {alert.room_id && (
                  <>
                    <span className="mx-2 text-muted-foreground">|</span>
                    <span>LOC: {alert.room_id.substring(0,8)}</span>
                  </>
                )}
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
