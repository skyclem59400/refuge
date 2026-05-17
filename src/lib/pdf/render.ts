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

/**
 * Rend un HTML en image PNG ou en PDF avec dimensions custom (pour visuels
 * réseaux sociaux : 1080x1350 ratio 4:5 Facebook/Insta, 1080x1080 carré, etc.).
 */
export async function renderHtmlToImage(
  html: string,
  opts: { width: number; height: number; format: 'png' | 'pdf' }
): Promise<Buffer> {
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
    await page.setViewport({ width: opts.width, height: opts.height, deviceScaleFactor: 2 })
    await page.setContent(html, { waitUntil: 'networkidle0' })

    if (opts.format === 'png') {
      const png = await page.screenshot({ type: 'png', omitBackground: false, fullPage: false })
      return Buffer.from(png)
    } else {
      const pdf = await page.pdf({
        width: `${opts.width}px`,
        height: `${opts.height}px`,
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      })
      return Buffer.from(pdf)
    }
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
