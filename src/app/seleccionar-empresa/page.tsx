'use client'

import { EmpresaSwitcher } from '@/components/empresa-switcher'

export default function SeleccionarEmpresaPage() {
  return (
    <div className="flex min-h-screen items-start justify-center bg-background">
      {/* Recarga completa (no navegación de Next) para que el selector del
          sidebar y el resto de la app vean la empresa recién creada o
          seleccionada sin depender de que el caché de Clerk se refresque solo. */}
      <EmpresaSwitcher mode="full" onSeleccionar={() => window.location.assign('/')} />
    </div>
  )
}
