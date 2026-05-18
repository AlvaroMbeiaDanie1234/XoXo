import { createClient } from './supabase/server'

interface SMSPayload {
  userId: string
  body: string
}

export async function sendSMS({ userId, body }: SMSPayload) {
  try {
    const supabase = await createClient()

    // 1. Fetch user's profile preferences
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('phone, sms_suspended_by_admin, sms_notifications_enabled')
      .eq('id', userId)
      .single()

    if (profileErr || !profile) {
      console.warn(`[TelcoSMS] Could not find profile for user ${userId}:`, profileErr)
      return { success: false, reason: 'Profile not found' }
    }

    const phone = profile.phone?.trim()
    if (!phone) {
      console.log(`[TelcoSMS] User ${userId} has no phone number configured. SMS skipped.`)
      return { success: false, reason: 'No phone number' }
    }

    if (profile.sms_suspended_by_admin) {
      console.log(`[TelcoSMS] SMS notification suspended by admin for user ${userId}.`)
      return { success: false, reason: 'Suspended by admin' }
    }

    if (!profile.sms_notifications_enabled) {
      console.log(`[TelcoSMS] SMS notification disabled by user ${userId} preferences.`)
      return { success: false, reason: 'Disabled by user' }
    }

    // 2. Fetch global TelcoSMS configurations from system_settings
    const { data: dbSettings } = await supabase
      .from('system_settings')
      .select('*')
      .in('key', ['TELCOSMS_API_KEY', 'TELCOSMS_SUSPENDED_GLOBAL'])

    let apiKey = process.env.TELCOSMS_API_KEY || 'prd02d5c425d862fc78245c5eaeef' // Fallback to provided PRD key
    let suspendedGlobal = false

    if (dbSettings) {
      const dbKey = dbSettings.find(s => s.key === 'TELCOSMS_API_KEY')?.value
      const dbSuspended = dbSettings.find(s => s.key === 'TELCOSMS_SUSPENDED_GLOBAL')?.value

      if (dbKey) apiKey = dbKey
      if (dbSuspended === 'true') suspendedGlobal = true
    }

    if (suspendedGlobal) {
      console.log(`[TelcoSMS] SMS notifications are globally suspended. Skipping message to ${phone}.`)
      return { success: false, reason: 'Globally suspended' }
    }

    if (!apiKey) {
      console.warn(`[TelcoSMS] No API Key configured. Skipping message to ${phone}.`)
      return { success: false, reason: 'No API Key' }
    }

    // Format phone number if necessary (TelcoSMS expects Angolan numbers usually, e.g. starting with 9...)
    let formattedPhone = phone.replace(/\D/g, '')
    if (formattedPhone.startsWith('244') && formattedPhone.length > 9) {
      formattedPhone = formattedPhone.substring(3)
    }

    console.log(`[TelcoSMS] Sending message to ${formattedPhone}...`)

    const payload = {
      message: {
        api_key_app: apiKey,
        phone_number: formattedPhone,
        message_body: body
      }
    }

    const response = await fetch('https://www.telcosms.co.ao/api/v2/send_message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    if (!response.ok) {
      console.error(`[TelcoSMS] Failed to send SMS to ${formattedPhone}. Status: ${response.status}`, data)
      return { success: false, reason: 'API Error', data }
    }

    console.log(`[TelcoSMS] Message successfully sent to ${formattedPhone}:`, data)
    return { success: true, data }
  } catch (err) {
    console.error(`[TelcoSMS] Unexpected error sending SMS:`, err)
    return { success: false, reason: 'Unexpected error', error: err }
  }
}
