type AuthFailure = { code?: string; status?: number; message?: string }

export function authFeedback(error: AuthFailure, emailRequest = false): string {
  if (error.code === 'over_email_send_rate_limit' || (emailRequest && error.status === 429)) {
    return 'Se alcanzó el límite de correos de Supabase. No sigas reenviando: esperá a que se restablezca. Si ya definiste una contraseña, podés ingresar con ella sin enviar correos.'
  }
  if (error.status === 429 || error.code === 'over_request_rate_limit') return 'Demasiados intentos. Esperá antes de volver a intentar.'
  if (error.code === 'invalid_credentials') return 'Correo o contraseña incorrectos. Si ingresaste sólo por enlace, todavía necesitás definir tu contraseña desde una sesión abierta.'
  if (error.code === 'email_not_confirmed') return 'Primero necesitás confirmar tu correo. La contraseña no evita esa verificación inicial.'
  if (error.code === 'otp_expired') return 'El enlace ya se usó o venció. Necesitás uno nuevo cuando esté disponible el envío de correos.'
  return error.message || 'No se pudo completar la solicitud. Volvé a intentar cuando tengas conexión.'
}

export function passwordValidation(password: string, confirmation: string): string | null {
  if (password.length < 12) return 'Elegí una contraseña de al menos 12 caracteres.'
  if (password !== confirmation) return 'Las contraseñas no coinciden.'
  return null
}

export function parseAccessLink(value: string, projectUrl: string) {
  const link = new URL(value)
  if (link.origin !== new URL(projectUrl).origin || link.pathname !== '/auth/v1/verify' || !link.searchParams.get('token')) {
    throw new Error('Pegá el enlace de acceso original de Supabase, no una dirección de localhost.')
  }
  const type = link.searchParams.get('type')
  if (type !== 'magiclink' && type !== 'signup' && type !== 'email' && type !== 'recovery') throw new Error('El enlace no es de ingreso o recuperación.')
  return { token_hash: link.searchParams.get('token')!, type }
}
