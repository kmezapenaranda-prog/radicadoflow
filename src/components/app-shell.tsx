'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
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

  const esRegistrador = perfil === 'registrador'
  const navItems = esRegistrador ? NAV_ITEMS.filter((item) => item.href === '/consecutivos') : NAV_ITEMS

  useEffect(() => {
    fetch('/api/configuracion')
      .then((res) => res.json())
      .then((data) => {
        setPersonaEnTurno(data.personaEnTurno?.nombre ?? null)
        setPerfil(data.perfil ?? null)
      })
      .catch(() => {})
  }, [pathname])

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
      <header className="flex items-center justify-between border-b bg-card px-4 py-3 lg:hidden">
        <span className="font-heading text-lg font-semibold">RadicadoFlow</span>
        <Button variant="ghost" size="icon-sm" onClick={() => setMenuAbierto((v) => !v)}>
          {menuAbierto ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </header>

      <aside
        className={cn(
          'w-full shrink-0 border-b bg-card lg:block lg:w-60 lg:border-b-0 lg:border-r',
          menuAbierto ? 'block' : 'hidden'
        )}
      >
        <div className="hidden px-4 py-5 lg:block">
          <span className="font-heading text-lg font-semibold">RadicadoFlow</span>
          <p className="text-xs text-muted-foreground">Asignación de radicados</p>
        </div>

        <div className="flex items-center gap-2 border-b p-3">
          <div className="min-w-0 flex-1">
            <EmpresaSwitcher mode="compact" />
          </div>
          <UserButton afterSignOutUrl="/sign-in" />
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
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  activo
                    ? 'bg-indigo-600 text-white'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t p-3">
          <p className="px-3 text-xs text-muted-foreground">Turno actual</p>
          <div className="px-3 py-1">
            {personaEnTurno ? (
              <Badge className="bg-indigo-600 text-white hover:bg-indigo-600">
                {personaEnTurno}
              </Badge>
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
