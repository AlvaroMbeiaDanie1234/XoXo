import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
export async function createClient() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

  // Detect active Supabase auth cookie (e.g. sb-xoxo-auth-token or sb-89-auth-token)
  const authCookie = allCookies.find(
    (c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'),
  )

  let defaultPrefix = 'sb-auth-token'
  try {
    const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xoxo.ao'
    defaultPrefix = `sb-${new URL(publicUrl).hostname.split('.')[0]}-auth-token`
  } catch {
    // fallback to generic
  }

  const cookieName = authCookie
    ? authCookie.name.replace(/\.\d+$/, '')
    : defaultPrefix

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
  // Always use ANON key for SSR client with user session cookies.
  // Administrative tasks that bypass RLS must use createAdminClient() instead.
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookieOptions: {
        name: cookieName,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // The "setAll" method was called from a Server Component.
            // This can be ignored if you have proxy refreshing
            // user sessions.
          }
        },
      },
    },
  )
}
