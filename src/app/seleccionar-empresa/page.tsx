'use client'

import { useRouter } from 'next/navigation'
import { EmpresaSwitcher } from '@/components/empresa-switcher'

export default function SeleccionarEmpresaPage() {
  const router = useRouter()

  return (
    <div className="flex min-h-screen items-start justify-center bg-background">
      <EmpresaSwitcher mode="full" onSeleccionar={() => router.push('/')} />
    </div>
  )
}
