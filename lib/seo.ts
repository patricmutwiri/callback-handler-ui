/**
 * Project Name: Callback Handler UI
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

export const SITE_NAME = 'Callback Handler'
export const DEFAULT_SITE_URL = 'https://callback-handler-ui.vercel.app'
export const DEFAULT_OG_IMAGE = `${DEFAULT_SITE_URL}/logo.png`

export const getSiteUrl = () => {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()

  if (!configuredUrl) {
    return DEFAULT_SITE_URL
  }

  return configuredUrl.replace(/\/+$/, '')
}

export const absoluteUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${getSiteUrl()}${normalizedPath}`
}
