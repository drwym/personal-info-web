import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nskqjukbkeznpserxilm.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5za3FqdWtia2V6bnBzZXJ4aWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTU1MjYsImV4cCI6MjEwMjU3MTUyNn0.1f_1gPJPtu1V-XXBpis3afmn7TxevYKbGbBT2htRCpE'

export const TABLE_NAME = 'client_info'
export const SOURCE_TABLE_NAME = 'source_options'
export const HOLIDAY_TABLE_NAME = 'holiday_data'
export const PRICE_TABLE_NAME = 'product_prices'
export const IMAGE_BUCKET_NAME = 'qixun-products'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'sb-client-auth',
    storage: window.localStorage
  },
  global: {
    fetch: (...args) => fetch(...args)
  }
})
