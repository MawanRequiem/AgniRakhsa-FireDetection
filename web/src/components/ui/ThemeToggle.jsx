import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  // Avoid hydration mismatch by waiting until component mounts
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Placeholder of same size to prevent layout shift
    return <div className="w-[110px] h-8 rounded-full border opacity-50" style={{ borderColor: 'var(--agni-border)', backgroundColor: 'var(--agni-bg-secondary)' }} />
  }

  return (
    <div className="flex items-center p-0.5 rounded-full border" style={{ borderColor: 'var(--agni-border)', backgroundColor: 'var(--agni-bg-secondary)' }}>
      <button
        onClick={() => setTheme('light')}
        className={`flex items-center justify-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-full transition-all ${
          resolvedTheme === 'light' 
            ? 'shadow-sm border' 
            : 'hover:text-[var(--agni-text-primary)]'
        }`}
        style={resolvedTheme === 'light' ? { 
          backgroundColor: 'var(--agni-bg-primary)', 
          borderColor: 'var(--agni-border)',
          color: 'var(--agni-text-primary)'
        } : { color: 'var(--agni-text-muted)' }}
        title="Switch to Light Mode"
      >
        <Sun className="w-3.5 h-3.5" />
        <span className="hidden sm:inline tracking-wider uppercase">Light</span>
      </button>
      
      <button
        onClick={() => setTheme('dark')}
        className={`flex items-center justify-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-full transition-all ${
          resolvedTheme === 'dark' 
            ? 'shadow-sm border' 
            : 'hover:text-[var(--agni-text-primary)]'
        }`}
        style={resolvedTheme === 'dark' ? { 
          backgroundColor: 'var(--agni-bg-primary)', 
          borderColor: 'var(--agni-border)',
          color: 'var(--agni-text-primary)'
        } : { color: 'var(--agni-text-muted)' }}
        title="Switch to Dark Mode"
      >
        <Moon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline tracking-wider uppercase">Dark</span>
      </button>
    </div>
  )
}
