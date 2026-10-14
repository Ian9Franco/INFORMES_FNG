import { createClient } from '@supabase/supabase-js'
const url=process.env.NEXT_PUBLIC_SUPABASE_URL
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
export const isSupabaseConfigured=Boolean(url&&key&&!url.includes('YOUR_PROJECT')&&!url.includes('example.supabase.co')&&!key.includes('YOUR_KEY')&&!key.includes('placeholder'))
// Capture the non-secret flow type before the SDK consumes and clears the hash.
export const isPasswordRecoveryRedirect=typeof window!=='undefined'&&new URLSearchParams(window.location.hash.slice(1)).get('type')==='recovery'
export const supabase=isSupabaseConfigured&&url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null
