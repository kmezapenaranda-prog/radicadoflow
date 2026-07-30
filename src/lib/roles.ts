import { auth, clerkClient } from '@clerk/nextjs/server'
import { NoEmpresaError } from './tenant'

export class ForbiddenError extends Error {}

export type Perfil = 'admin' | 'creador' | 'registrador'

// El "perfil" de cada persona dentro de su empresa se guarda como metadata
// pública de su membresía de Clerk Organization (publicMetadata.perfil),
// no como un rol nativo de Clerk — los roles personalizados de Clerk
// requieren un complemento de pago ("B2B Authentication add-on") que este
// proyecto no usa.
export async function getPerfilActual(): Promise<{ empresaId: string; userId: string; perfil: Perfil }> {
  const { orgId, userId } = await auth()
  if (!orgId) throw new NoEmpresaError('No hay una empresa activa seleccionada')
  if (!userId) throw new NoEmpresaError('No hay sesión activa')

  const clerk = await clerkClient()
  const { data } = await clerk.organizations.getOrganizationMembershipList({
    organizationId: orgId,
    userId: [userId],
    limit: 1,
  })
  const membresia = data[0]
  const metadataPerfil = (membresia?.publicMetadata as { perfil?: Perfil } | undefined)?.perfil
  // Quien crea la empresa queda como org:admin nativo de Clerk; si todavía
  // no tiene perfil propio asignado, se le trata como admin por defecto.
  // Cualquier otro miembro sin perfil asignado cae al más restrictivo.
  const perfil: Perfil = metadataPerfil ?? (membresia?.role === 'org:admin' ? 'admin' : 'registrador')

  return { empresaId: orgId, userId, perfil }
}

export async function requireRole(rolesPermitidos: Perfil[]) {
  const { empresaId, perfil } = await getPerfilActual()
  if (!rolesPermitidos.includes(perfil)) {
    throw new ForbiddenError('No tienes permiso para hacer esto')
  }
  return { empresaId, perfil }
}
