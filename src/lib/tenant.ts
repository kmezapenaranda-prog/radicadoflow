import { obtenerUsuarioSesion } from './sesion'

export class NoEmpresaError extends Error {}

export async function requireEmpresaId(): Promise<string> {
  const usuario = await obtenerUsuarioSesion()
  if (!usuario) throw new NoEmpresaError('No hay sesión activa')
  if (!usuario.empresaId) throw new NoEmpresaError('No hay una empresa activa seleccionada')
  return usuario.empresaId
}
