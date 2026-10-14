import type { MetadataRoute } from 'next'
export default function manifest(): MetadataRoute.Manifest {
 return {name:'Informes FNG',short_name:'FNG Ads',description:'Seguimiento de clientes, revisiones e informes publicitarios',start_url:'/',display:'standalone',background_color:'#f2f3ef',theme_color:'#172c2a',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]}
}
