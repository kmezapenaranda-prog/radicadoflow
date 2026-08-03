import { NoEmpresaError } from './tenant'
import { obtenerUsuarioSesion } from './sesion'

export class ForbiddenError extends Error {}

export type Perfil = 'admin' | 'creador' | 'registrador'
export const PERFILES_VALIDOS: Perfil[] = ['admin', 'creador', 'registrador']

// El "perfil" de cada persona dentro de su empresa vive en la tabla Usuario
// (columna perfil), salvo el super admin, para quien siempre se resuelve
// como "admin" (ver resolverClaims en sesion.ts).
export async function getPerfilActual(): Promise<{
  empresaId: string
  userId: string
  perfil: Perfil
  esSuperAdmin: boolean
  nombre: string
  email: string
}> {
  const usuario = await obtenerUsuarioSesion()
  if (!usuario) throw new NoEmpresaError('No hay sesión activa')
  if (!usuario.empresaId) throw new NoEmpresaError('No hay una empresa activa seleccionada')

  return {
    empresaId: usuario.empresaId,
    userId: usuario.usuarioId,
    perfil: usuario.perfil as Perfil,
    esSuperAdmin: usuario.esSuperAdmin,
    nombre: usuario.nombre,
    email: usuario.email,
  }
}

export async function requireRole(rolesPermitidos: Perfil[]) {
  const { empresaId, perfil } = await getPerfilActual()
  if (!rolesPermitidos.includes(perfil)) {
    throw new ForbiddenError('No tienes permiso para hacer esto')
  }
  return { empresaId, perfil }
}

// El dueño del sistema (una sola cuenta, marcada con Usuario.esSuperAdmin)
// es quien crea las empresas y las cuentas de los usuarios directamente --
// nadie se autorregistra ni se invita por correo.
export async function requireSuperAdmin() {
  const usuario = await obtenerUsuarioSesion()
  if (!usuario) throw new NoEmpresaError('No hay sesión activa')
  if (!usuario.esSuperAdmin) {
    throw new ForbiddenError('Solo el administrador del sistema puede hacer esto')
  }
  return { userId: usuario.usuarioId }
}
