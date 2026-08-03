import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Crea la única cuenta inicial (super admin) para que el dueño del sistema
// pueda entrar por primera vez. Usa la misma contraseña temporal genérica
// que cualquier cuenta creada después, y también la obliga a cambiarla.
async function main() {
  const email = 'kmezapenaranda@gmail.com'
  const passwordTemporal = process.env.PASSWORD_TEMPORAL_GENERICA || 'Radicado#Temporal2026'

  const existente = await prisma.usuario.findUnique({ where: { email } })
  if (existente) {
    console.log(`Ya existe un usuario con el correo ${email}, no se creó nada.`)
    return
  }

  const passwordHash = await bcrypt.hash(passwordTemporal, 10)

  const usuario = await prisma.usuario.create({
    data: {
      email,
      nombre: 'Kevin Meza',
      passwordHash,
      esSuperAdmin: true,
      empresaId: null,
      debeCambiarPassword: true,
    },
  })

  console.log('Super admin creado:')
  console.log(`  Correo: ${usuario.email}`)
  console.log(`  Contraseña temporal: ${passwordTemporal}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
