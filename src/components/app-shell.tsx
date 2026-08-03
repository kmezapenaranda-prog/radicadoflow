'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { EmpresaSwitcher } from '@/components/empresa-switcher'
import {
  LayoutDashboard,
  PlusCircle,
  ListOrdered,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/registrar', label: 'Registrar', icon: PlusCircle },
  { href: '/consecutivos', label: 'Consecutivos', icon: ListOrdered },
  { href: '/informes', label: 'Informes', icon: BarChart3 },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [personaEnTurno, setPersonaEnTurno] = useState<string | null>(null)
  const [perfil, setPerfil] = useState<string | null>(null)
  const [usuario, setUsuario] = useState<{ nombre: string; email: string } | null>(null)

  const esRegistrador = perfil === 'registrador'
  const navItems = esRegistrador ? NAV_ITEMS.filter((item) => item.href === '/consecutivos') : NAV_ITEMS

  useEffect(() => {
    fetch('/api/configuracion')
      .then((res) => res.json())
      .then((data) => {
        setPersonaEnTurno(data.personaEnTurno?.nombre ?? null)
        setPerfil(data.perfil ?? null)
        setUsuario(data.usuario ?? null)
      })
      .catch(() => {})
  }, [pathname])

  async function cerrarSesion() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.assign('/sign-in')
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault()
        router.push('/registrar')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [router])

  useEffect(() => {
    setMenuAbierto(false)
  }, [pathname])

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
      <header className="flex items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-3 lg:hidden">
        <span className="text-lg font-semibold tracking-tight">RadicadoFlow</span>
        <Button variant="ghost" size="icon-sm" onClick={() => setMenuAbierto((v) => !v)}>
          {menuAbierto ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </header>

      <aside
        className={cn(
          'w-full shrink-0 border-sidebar-border bg-sidebar text-sidebar-foreground lg:block lg:w-64 lg:border-r',
          menuAbierto ? 'block' : 'hidden'
        )}
      >
        <div className="hidden border-b border-sidebar-border px-4 py-5 lg:block">
          <span className="text-lg font-semibold tracking-tight">RadicadoFlow</span>
          <p className="num-folio mt-0.5 text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
            Registro de radicados
          </p>
        </div>

        <div className="flex items-center gap-2 border-b border-sidebar-border p-3">
          <div className="min-w-0 flex-1">
            <EmpresaSwitcher mode="compact" />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            title={usuario ? `${usuario.nombre} (${usuario.email})` : 'Cerrar sesión'}
            onClick={cerrarSesion}
          >
            <LogOut className="size-4" />
          </Button>
        </div>

        <nav className="flex flex-col gap-1 p-3">
          {navItems.map((item) => {
            const activo = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  activo
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <p className="px-3 text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
            Turno actual
          </p>
          <div className="px-3 py-2">
            {personaEnTurno ? (
              <span
                className="num-folio inline-block -rotate-2 rounded-sm border-2 border-primary/70 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-primary"
                style={{ boxShadow: 'inset 0 0 0 1px color-mix(in oklch, var(--primary), transparent 80%)' }}
              >
                {personaEnTurno}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Sin asignar</span>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  )
}
