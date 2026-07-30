import { auth } from '@clerk/nextjs/server'

export class NoEmpresaError extends Error {}

export async function requireEmpresaId(): Promise<string> {
  const { orgId } = await auth()
  if (!orgId) throw new NoEmpresaError('No hay una empresa activa seleccionada')
  return orgId
}
