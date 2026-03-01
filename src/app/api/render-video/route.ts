import { NextResponse } from 'next/server'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/establishment/permissions'
import type { VideoProps } from '@/remotion/types'

export async function POST(request: Request) {
  try {
    const { establishmentId } = await requirePermission('manage_posts')

    const body = await request.json() as VideoProps

    // Validate required fields
    if (!body.postType || !body.content || !body.establishmentName) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
    }

    // Dynamic imports for server-only modules
    const { bundle } = await import('@remotion/bundler')
    const { renderMedia, selectComposition } = await import('@remotion/renderer')

    // Bundle the Remotion project (or use pre-bundled in production)
    const bundlePath = path.join(process.cwd(), 'public', 'remotion-bundle')
    const hasPrebundle = fs.existsSync(path.join(bundlePath, 'index.html'))

    let serveUrl: string
    if (hasPrebundle) {
      serveUrl = bundlePath
    } else {
      // Dev mode: bundle on-the-fly
      const entryPoint = path.join(process.cwd(), 'src', 'remotion', 'index.tsx')
      serveUrl = await bundle({
        entryPoint,
        onProgress: (progress: number) => {
          console.log(`Remotion bundle progress: ${Math.round(progress * 100)}%`)
        },
      })
    }

    const compositionId = body.postType
    const inputProps = {
      postType: body.postType,
      animalName: body.animalName,
      animalSpecies: body.animalSpecies,
      photoUrls: body.photoUrls || [],
      content: body.content,
      establishmentName: body.establishmentName,
      establishmentPhone: body.establishmentPhone || '',
    } satisfies VideoProps

    const propsRecord = inputProps as unknown as Record<string, unknown>

    const composition = await selectComposition({
      serveUrl,
      id: compositionId,
      inputProps: propsRecord,
    })

    const outputPath = path.join(os.tmpdir(), `remotion-${crypto.randomUUID()}.mp4`)

    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: propsRecord,
      browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    })

    // Read the rendered file and upload to Supabase Storage
    const videoBuffer = fs.readFileSync(outputPath)
    const fileName = `${establishmentId}/${crypto.randomUUID()}.mp4`

    const adminClient = createAdminClient()
    const { error: uploadError } = await adminClient.storage
      .from('social-media')
      .upload(fileName, videoBuffer, {
        contentType: 'video/mp4',
        upsert: false,
      })

    // Clean up temp file
    fs.unlinkSync(outputPath)

    if (uploadError) {
      return NextResponse.json({ error: 'Erreur lors de l\'upload: ' + uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = adminClient.storage
      .from('social-media')
      .getPublicUrl(fileName)

    return NextResponse.json({ url: publicUrl })
  } catch (error) {
    console.error('Render video error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors du rendu video' },
      { status: 500 }
    )
  }
}
