import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import id from '@/i18n/id.json';
import en from '@/i18n/en.json';

const translations = { id, en };

const LanguageContext = createContext(null);

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ifrit-lang') || 'id';
    }
    return 'id';
  });

  const setLang = useCallback((newLang) => {
    setLangState(newLang);
    localStorage.setItem('ifrit-lang', newLang);
    document.documentElement.lang = newLang;
  }, []);

  const t = useCallback((key) => {
    const value = getNestedValue(translations[lang], key);
    if (value === undefined) {
      console.warn(`Missing translation: ${key} [${lang}]`);
      return key;
    }
    return value;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
