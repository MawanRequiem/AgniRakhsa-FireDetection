import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="w-[110px] h-8 rounded-full border opacity-50" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }} />
  }

  return (
    // Div ini bertindak sebagai kontainer saja, BUKAN tombol
    <div className="flex items-center p-0.5 rounded-full border" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
      <button
        type="button" // Tambahkan type="button" agar tidak dianggap submit
        onClick={() => setTheme('light')}
        className={`flex items-center justify-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-full transition-all ${
          resolvedTheme === 'light' 
            ? 'shadow-sm border' 
            : 'hover:text-[var(--ifrit-text-primary)] opacity-60'
        }`}
        style={resolvedTheme === 'light' ? { 
          backgroundColor: 'var(--ifrit-bg-primary)', 
          borderColor: 'var(--ifrit-border)',
          color: 'var(--ifrit-text-primary)'
        } : { color: 'var(--ifrit-text-muted)' }}
      >
        <Sun className="w-3.5 h-3.5" />
        <span className="hidden sm:inline tracking-wider uppercase">Light</span>
      </button>
      
      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`flex items-center justify-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-full transition-all ${
          resolvedTheme === 'dark' 
            ? 'shadow-sm border' 
            : 'hover:text-[var(--ifrit-text-primary)] opacity-60'
        }`}
        style={resolvedTheme === 'dark' ? { 
          backgroundColor: 'var(--ifrit-bg-primary)', 
          borderColor: 'var(--ifrit-border)',
          color: 'var(--ifrit-text-primary)'
        } : { color: 'var(--ifrit-text-muted)' }}
      >
        <Moon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline tracking-wider uppercase">Dark</span>
      </button>
    </div>
  )
}