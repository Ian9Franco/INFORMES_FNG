import type { MetadataRoute } from 'next'
export default function manifest(): MetadataRoute.Manifest {
 return {name:'Informes FNG',short_name:'FNG Ads',description:'Revisiones de Meta Ads',start_url:'/',display:'standalone',background_color:'#101a2e',theme_color:'#101a2e',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]}
}
