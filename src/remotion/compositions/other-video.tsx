import { AbsoluteFill } from 'remotion'
import { Background } from '../components/background'
import { LogoWatermark } from '../components/logo-watermark'
import { AnimalPhoto } from '../components/animal-photo'
import { ContentOverlay, CtaOverlay } from '../components/text-overlay'
import { MusicLayer } from '../components/music-layer'
import { POST_TYPE_COLORS, type VideoProps } from '../types'

export function OtherVideo({ photoUrls, content, establishmentName, logoUrl, videoText, musicUrl }: VideoProps) {
  const colors = POST_TYPE_COLORS.other

  return (
    <AbsoluteFill>
      <Background gradient={colors.gradient} />
      <LogoWatermark name={establishmentName} color={colors.primary} logoUrl={logoUrl} />
      {photoUrls[0] && <AnimalPhoto url={photoUrls[0]} />}
      <ContentOverlay text={videoText || content} startFrame={60} />
      <CtaOverlay text={establishmentName} color={colors.primary} />
      {musicUrl && <MusicLayer url={musicUrl} />}
    </AbsoluteFill>
  )
}
