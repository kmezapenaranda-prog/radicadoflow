import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

// Contraseña temporal compartida: el super admin crea la cuenta con esta
// clave y la persona la cambia obligatoriamente en su primer ingreso.
export const PASSWORD_TEMPORAL = process.env.PASSWORD_TEMPORAL_GENERICA || 'Radicado#Temporal2026'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
