import type { MetadataRoute } from 'next'
export default function manifest(): MetadataRoute.Manifest {
 return {name:'Informes FNG',short_name:'FNG Ads',description:'Seguimiento de clientes, revisiones e informes publicitarios',start_url:'/',display:'standalone',background_color:'#eef2ef',theme_color:'#eef2ef',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]}
}
