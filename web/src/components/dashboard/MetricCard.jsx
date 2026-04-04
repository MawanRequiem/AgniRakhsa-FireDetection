import { motion } from 'framer-motion';
import PropTypes from 'prop-types';

export default function MetricCard({ title, value, icon: Icon, trend, trendLabel, color = 'blue' }) {
  const colorVariants = {
    blue: 'border-[var(--agni-border)] text-blue-500 bg-[var(--agni-bg-primary)]',
    amber: 'border-amber-500/50 text-amber-500 bg-amber-500/5',
    red: 'border-red-500/80 text-red-500 bg-red-500/10',
    green: 'border-green-500/50 text-green-500 bg-green-500/5',
    purple: 'border-[var(--agni-border)] text-purple-500 bg-[var(--agni-bg-primary)]',
  };

  const styleClass = colorVariants[color] || colorVariants.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden card-shadow p-5 ${styleClass} transition-shadow hover:shadow-md border`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          <h3 className="mt-2 font-mono text-3xl font-bold tracking-tight text-foreground">{value}</h3>
          
          {trend && (
            <div className="mt-2 flex items-center font-mono text-xs">
              <span className={`font-semibold ${trend.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                {trend}
              </span>
              <span className="ml-1 text-muted-foreground font-sans uppercase text-[10px] tracking-wider">{trendLabel}</span>
            </div>
          )}
        </div>
        
        {Icon && (
          <div className={`p-2 opacity-80`}>
            <Icon className="h-6 w-6" strokeWidth={2} />
          </div>
        )}
      </div>
      
      {/* Accent Line for Industrial Feel instead of blur */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${color === 'blue' || color === 'purple' ? 'bg-transparent' : 'bg-current opacity-70'}`} />
    </motion.div>
  );
}

MetricCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  icon: PropTypes.elementType,
  trend: PropTypes.string,
  trendLabel: PropTypes.string,
  color: PropTypes.oneOf(['blue', 'amber', 'red', 'green', 'purple'])
};
