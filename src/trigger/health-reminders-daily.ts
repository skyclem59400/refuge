import { logger, schedules } from '@trigger.dev/sdk/v3'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

// Runs every day at 7am Europe/Paris.
// Calls the scan_health_reminders() RPC which:
//   - Iterates animal_health_records with next_due_date in [today; today+7]
//   - Creates a 'health_reminder' notification for each manager of the establishment
//     (admin / is_owner / permission group with manage_health = true)
//   - Deduplicates : skips records already notified within last 6 days
export const healthRemindersDaily = schedules.task({
  id: 'health-reminders-daily',
  cron: {
    pattern: '0 7 * * *',
    timezone: 'Europe/Paris',
  },
  run: async () => {
    logger.info('Scanning upcoming health reminders...')
    const supabase = getSupabase()

    const { data, error } = await supabase.rpc('scan_health_reminders')

    if (error) {
      logger.error('scan_health_reminders failed', { error: error.message })
      throw new Error(error.message)
    }

    const created = typeof data === 'number' ? data : 0
    logger.info(`Created ${created} health reminder notifications`)

    return { createdNotifications: created, ranAt: new Date().toISOString() }
  },
})
