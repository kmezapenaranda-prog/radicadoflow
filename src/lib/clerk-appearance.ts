// Estilo del widget de Clerk (login, selector de cuenta, etc.) para que se
// vea como el resto de la app (shadcn/Tailwind, neutro + acentos oscuros)
// en vez del tema por defecto de Clerk.
export const clerkAppearance = {
  variables: {
    colorPrimary: '#18181b',
    colorBackground: '#ffffff',
    colorInputBackground: '#ffffff',
    colorText: '#171717',
    colorTextSecondary: '#71717a',
    colorInputText: '#171717',
    colorDanger: '#dc2626',
    borderRadius: '0.625rem',
    fontFamily: 'var(--font-geist-sans), sans-serif',
  },
  elements: {
    rootBox: 'w-full',
    card: 'shadow-none border border-neutral-200',
    headerTitle: 'text-foreground',
    headerSubtitle: 'text-muted-foreground',
    formButtonPrimary:
      'bg-neutral-900 hover:bg-neutral-800 text-white text-sm normal-case shadow-none',
    footerActionLink: 'text-neutral-900 hover:text-neutral-700',
    // No hay autorregistro (ver /sign-up), así que ocultamos el "¿No tienes
    // cuenta? Regístrate" que Clerk agrega por defecto en el login.
    footerAction: 'hidden',
    logoBox: 'hidden',
  },
}
