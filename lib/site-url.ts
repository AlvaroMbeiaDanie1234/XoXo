const DEFAULT_SITE_URL = 'https://www.xoxo.ao'
const LOCALHOST_URL_PATTERN = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i

function normalizeSiteUrl(value: string | undefined) {
  const configuredUrl = value?.trim() || DEFAULT_SITE_URL
  const urlWithProtocol = /^https?:\/\//i.test(configuredUrl)
    ? configuredUrl
    : `https://${configuredUrl}`

  const normalizedUrl = urlWithProtocol.replace(/\/+$/, '')

  if (LOCALHOST_URL_PATTERN.test(normalizedUrl)) {
    return DEFAULT_SITE_URL
  }

  return normalizedUrl
}

export function getPublicSiteUrl() {
  return normalizeSiteUrl(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_BASE_URL,
  )
}
