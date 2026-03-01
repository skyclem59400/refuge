import { AbsoluteFill } from 'remotion'
import { Background } from '../components/background'
import { LogoWatermark } from '../components/logo-watermark'
import { AnimalPhoto } from '../components/animal-photo'
import { TitleOverlay, ContentOverlay, CtaOverlay } from '../components/text-overlay'
import { MusicLayer } from '../components/music-layer'
import { POST_TYPE_COLORS, type VideoProps } from '../types'

export function InfoVideo({ photoUrls, content, establishmentName, logoUrl, videoText, musicUrl }: VideoProps) {
  const colors = POST_TYPE_COLORS.info

  return (
    <AbsoluteFill>
      <Background gradient={colors.gradient} />
      <LogoWatermark name={establishmentName} color={colors.primary} logoUrl={logoUrl} />
      <TitleOverlay text="INFO" color={colors.primary} />
      {photoUrls[0] && <AnimalPhoto url={photoUrls[0]} />}
      <ContentOverlay text={videoText || content} />
      <CtaOverlay text={establishmentName} color={colors.primary} />
      {musicUrl && <MusicLayer url={musicUrl} />}
    </AbsoluteFill>
  )
}
