// Helper Puppeteer mutualisé pour rendre un HTML A4 en PDF.

export async function renderHtmlToPdf(html: string, opts?: { landscape?: boolean }): Promise<Buffer> {
  const puppeteer = await import('puppeteer')
  const browser = await puppeteer.default.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--user-data-dir=/tmp/chrome-data',
    ],
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      landscape: opts?.landscape ?? false,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

export async function fetchLogoBase64(logoUrl: string | null): Promise<string | undefined> {
  if (!logoUrl) return undefined
  try {
    const res = await fetch(logoUrl)
    if (!res.ok) return undefined
    const buf = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') || 'image/png'
    return `data:${contentType};base64,${Buffer.from(buf).toString('base64')}`
  } catch {
    return undefined
  }
}
