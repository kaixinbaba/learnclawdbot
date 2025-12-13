import { db } from '@/lib/db'
import { userSource } from '@/lib/db/schema'
import Bowser from 'bowser'
import { headers } from 'next/headers'

/**
 * Client tracking data collected from the browser
 */
export interface ClientTrackingData {
  // UTM parameters
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmTerm?: string
  utmContent?: string
  // Referrer
  referrer?: string
  landingPage?: string
  // Device info
  screenWidth?: number
  screenHeight?: number
  language?: string
  timezone?: string
}

/**
 * Parsed user agent data
 */
export interface ParsedUserAgent {
  browser?: string
  browserVersion?: string
  os?: string
  osVersion?: string
  deviceType?: string
  deviceBrand?: string
  deviceModel?: string
}

/**
 * Geo location data from Cloudflare headers
 */
export interface GeoLocationData {
  ipAddress?: string
  country?: string
  countryCode?: string
  region?: string
  city?: string
  continent?: string
}

/**
 * Complete user source data
 */
export interface UserSourceData {
  userId: string
  // Referral code (from URL params like ref, via, referral, etc.)
  referralCode?: string
  // UTM
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmTerm?: string
  utmContent?: string
  // Referrer
  referrer?: string
  referrerDomain?: string
  landingPage?: string
  // Device & Browser
  userAgent?: string
  browser?: string
  browserVersion?: string
  os?: string
  osVersion?: string
  deviceType?: string
  deviceBrand?: string
  deviceModel?: string
  screenWidth?: number
  screenHeight?: number
  language?: string
  timezone?: string
  // Network & Location
  ipAddress?: string
  country?: string
  countryCode?: string
  region?: string
  city?: string
  continent?: string
  // Extra
  metadata?: Record<string, unknown>
}

/**
 * Parse user agent string using bowser (MIT license)
 */
export function parseUserAgent(userAgentString: string): ParsedUserAgent {
  const parser = Bowser.parse(userAgentString)

  // Determine device type
  let deviceType: string | undefined
  if (parser.platform.type) {
    deviceType = parser.platform.type // 'mobile', 'tablet', 'desktop'
  } else {
    deviceType = 'desktop'
  }

  return {
    browser: parser.browser.name,
    browserVersion: parser.browser.version,
    os: parser.os.name,
    osVersion: parser.os.version,
    deviceType,
    deviceBrand: parser.platform.vendor,
    deviceModel: parser.platform.model,
  }
}

/**
 * Extract geo location data from Cloudflare headers
 */
export async function getCloudflareGeoHeaders(): Promise<GeoLocationData> {
  const headersList = await headers()

  // IP address (priority: cf-connecting-ip > x-real-ip > x-forwarded-for)
  const cfIP = headersList.get('cf-connecting-ip')
  const realIP = headersList.get('x-real-ip')
  const forwarded = headersList.get('x-forwarded-for')
  const ipAddress = cfIP || realIP || (forwarded ? forwarded.split(',')[0].trim() : undefined)

  // Cloudflare geo headers
  const countryCode = headersList.get('cf-ipcountry') || undefined
  const city = headersList.get('cf-ipcity') || undefined
  const region = headersList.get('cf-region') || undefined
  const continent = headersList.get('cf-ipcontinent') || undefined
  const country = headersList.get('cf-ipcountry-name') || undefined

  return {
    ipAddress,
    country,
    countryCode,
    region,
    city,
    continent,
  }
}

/**
 * Extract referrer domain from full referrer URL
 */
export function extractReferrerDomain(referrer: string | undefined): string | undefined {
  if (!referrer) return undefined

  try {
    const url = new URL(referrer)
    return url.hostname
  } catch {
    return undefined
  }
}

/**
 * Extract UTM parameters from URL string
 */
export function extractUtmParams(urlString: string): Partial<ClientTrackingData> {
  try {
    const url = new URL(urlString)
    return {
      utmSource: url.searchParams.get('utm_source') || undefined,
      utmMedium: url.searchParams.get('utm_medium') || undefined,
      utmCampaign: url.searchParams.get('utm_campaign') || undefined,
      utmTerm: url.searchParams.get('utm_term') || undefined,
      utmContent: url.searchParams.get('utm_content') || undefined,
    }
  } catch {
    return {}
  }
}

/**
 * Get user agent from headers
 */
export async function getUserAgentFromHeaders(): Promise<string | undefined> {
  const headersList = await headers()
  return headersList.get('user-agent') || undefined
}

/**
 * Build complete user source data from client data and server headers
 */
export async function buildUserSourceData(
  userId: string,
  clientData?: ClientTrackingData,
  referralCode?: string
): Promise<UserSourceData> {
  // Get server-side data
  const geoData = await getCloudflareGeoHeaders()
  const userAgentString = await getUserAgentFromHeaders()
  const parsedUA = userAgentString ? parseUserAgent(userAgentString) : {}

  // Extract referrer domain
  const referrerDomain = extractReferrerDomain(clientData?.referrer)

  return {
    userId,
    // Referral code
    referralCode,
    // UTM from client
    utmSource: clientData?.utmSource,
    utmMedium: clientData?.utmMedium,
    utmCampaign: clientData?.utmCampaign,
    utmTerm: clientData?.utmTerm,
    utmContent: clientData?.utmContent,
    // Referrer
    referrer: clientData?.referrer,
    referrerDomain,
    landingPage: clientData?.landingPage,
    // Device & Browser (from server-side UA parsing)
    userAgent: userAgentString,
    ...parsedUA,
    // Screen info from client
    screenWidth: clientData?.screenWidth,
    screenHeight: clientData?.screenHeight,
    language: clientData?.language,
    timezone: clientData?.timezone,
    // Geo from Cloudflare
    ...geoData,
  }
}

/**
 * Save user source data to database
 */
export async function saveUserSource(data: UserSourceData): Promise<void> {
  try {
    await db.insert(userSource).values({
      userId: data.userId,
      // Referral code
      referralCode: data.referralCode,
      // UTM
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      utmTerm: data.utmTerm,
      utmContent: data.utmContent,
      // Referrer
      referrer: data.referrer,
      referrerDomain: data.referrerDomain,
      landingPage: data.landingPage,
      // Device & Browser
      userAgent: data.userAgent,
      browser: data.browser,
      browserVersion: data.browserVersion,
      os: data.os,
      osVersion: data.osVersion,
      deviceType: data.deviceType,
      deviceBrand: data.deviceBrand,
      deviceModel: data.deviceModel,
      screenWidth: data.screenWidth,
      screenHeight: data.screenHeight,
      language: data.language,
      timezone: data.timezone,
      // Network & Location
      ipAddress: data.ipAddress,
      country: data.country,
      countryCode: data.countryCode,
      region: data.region,
      city: data.city,
      continent: data.continent,
      // Extra
      metadata: data.metadata,
    })
    console.log(`User source saved for user ${data.userId}`)
  } catch (error) {
    console.error('Failed to save user source:', error)
  }
}

/**
 * Cookie name for storing client tracking data
 */
export const TRACKING_COOKIE_NAME = 'user_tracking_data'

/**
 * Parse tracking data from cookie value
 */
export function parseTrackingCookie(cookieValue: string | undefined): ClientTrackingData | null {
  if (!cookieValue) return null

  try {
    return JSON.parse(decodeURIComponent(cookieValue))
  } catch {
    return null
  }
}
