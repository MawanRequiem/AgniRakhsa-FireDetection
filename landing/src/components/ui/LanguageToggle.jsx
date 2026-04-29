import { useLanguage } from '@/hooks/useLanguage';

export default function LanguageToggle({ className = '' }) {
  const { lang, setLang } = useLanguage();

  return (
    <button
      onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
      className={`
        relative flex items-center gap-1
        px-3 py-1.5 rounded-[var(--radius-full)]
        text-sm font-body font-medium tracking-wide
        border border-current/20
        transition-colors duration-[var(--duration-fast)]
        hover:bg-white/10
        cursor-pointer select-none
        ${className}
      `.replace(/\s+/g, ' ').trim()}
      aria-label={lang === 'id' ? 'Switch to English' : 'Ganti ke Bahasa Indonesia'}
    >
      <span className={lang === 'id' ? 'opacity-100' : 'opacity-40'}>ID</span>
      <span className="opacity-30">|</span>
      <span className={lang === 'en' ? 'opacity-100' : 'opacity-40'}>EN</span>
    </button>
  );
}
