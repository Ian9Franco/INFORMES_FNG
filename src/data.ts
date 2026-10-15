import type { AdvertisingAccount } from './account-catalog'
export type Client = { id: string; name: string; active: boolean; advertisingAccounts?: AdvertisingAccount[] }
import type { CustomAction, ReviewAction } from './review-actions'
export type Review = { id: string; clientId: string; date: string; createdAt: string; actions: string; observations: string; actionSchemaVersion?: 1; actionEntries?: ReviewAction[]; revision?: number }
export type Pending = { id: string; clientId: string; text: string; resolved: boolean }
export type Activity = { id: string; platform: 'meta_ads' | 'google_ads'; accountCandidate: string | null; clientId: string | null; startedAt: string; endedAt: string; focusedMs: number; navigationSignals: number; date: string; status: 'pending' | 'dismissed' }
export type Store = { clients: Client[]; reviews: Review[]; pending: Pending[]; closed: string[]; accountCatalogVersion?: number; activity?: Activity[]; customActions?: CustomAction[] }
export const initial = ():Store => ({clients:[],reviews:[],pending:[],closed:[]})
const key='informes-fng-v1'
export function load():Store { try { const v=JSON.parse(localStorage.getItem(key)||'null'); return v && Array.isArray(v.clients) && Array.isArray(v.reviews) && Array.isArray(v.pending) && Array.isArray(v.closed) ? v as Store : initial() } catch { return initial() } }
export function persist(v:Store) { localStorage.setItem(key,JSON.stringify(v)) }
export const keyDate=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')
export const date=(s:string)=>new Date(s+'T12:00:00')
export function monday(d:Date) { const x=new Date(d.getFullYear(),d.getMonth(),d.getDate(),12); x.setDate(x.getDate()-(x.getDay()+6)%7); return keyDate(x) }
export function weekDays(s:string){ const d=date(s); return Array.from({length:6},(_,i)=>{const x=new Date(d);x.setDate(x.getDate()+i);return keyDate(x)}) }
export const format=(s:string)=>date(s).toLocaleDateString('es-AR',{day:'2-digit',month:'short'})
