// No hay autorregistro: el dueño del sistema crea cada cuenta directamente
// (ver /api/admin/usuarios) y le entrega un usuario y contraseña temporal.
export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-sm text-center text-sm text-muted-foreground">
        El registro no está disponible. Pide al administrador del sistema que cree tu cuenta.
      </div>
    </div>
  )
}
