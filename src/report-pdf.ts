import { PDFDocument } from 'pdf-lib'

const A4 = { width: 595.28, height: 841.89 }

export async function pdfFromPngs(pngs: readonly Uint8Array[]): Promise<Uint8Array> {
  if (!pngs.length) throw new Error('El informe no tiene páginas.')
  const pdf = await PDFDocument.create()
  for (const bytes of pngs) {
    const image = await pdf.embedPng(bytes)
    const page = pdf.addPage([A4.width, A4.height])
    const scale = Math.min(A4.width / image.width, A4.height / image.height)
    const width = image.width * scale
    const height = image.height * scale
    page.drawImage(image, { x: (A4.width - width) / 2, y: (A4.height - height) / 2, width, height })
  }
  return pdf.save()
}

export async function captureReportPngs(root: ParentNode): Promise<Uint8Array[]> {
  const { toPng } = await import('html-to-image')
  const pages = [...root.querySelectorAll<HTMLElement>('.notebook-report')].filter(page => !page.closest('.detail-measure'))
  const pngs: Uint8Array[] = []
  for (const page of pages) {
    const dataUrl = await toPng(page, { pixelRatio: 2, backgroundColor: '#ffffff', skipFonts: true, style: { position: 'static', left: '0', top: '0', transform: 'none' } })
    const binary = atob(dataUrl.split(',')[1] ?? '')
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
    pngs.push(bytes)
  }
  if (!pngs.length) throw new Error('No se pudo armar el informe.')
  return pngs
}
