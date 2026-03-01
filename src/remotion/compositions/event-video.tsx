import { AbsoluteFill } from 'remotion'
import { Background } from '../components/background'
import { LogoWatermark } from '../components/logo-watermark'
import { AnimalPhoto } from '../components/animal-photo'
import { TitleOverlay, ContentOverlay, CtaOverlay } from '../components/text-overlay'
import { MusicLayer } from '../components/music-layer'
import { POST_TYPE_COLORS, type VideoProps } from '../types'

export function EventVideo({ photoUrls, content, establishmentName, establishmentPhone, logoUrl, videoText, musicUrl }: VideoProps) {
  const colors = POST_TYPE_COLORS.event

  return (
    <AbsoluteFill>
      <Background gradient={colors.gradient} />
      <LogoWatermark name={establishmentName} color={colors.primary} logoUrl={logoUrl} />
      <TitleOverlay text="EVENEMENT" color={colors.primary} />
      {photoUrls[0] && <AnimalPhoto url={photoUrls[0]} />}
      <ContentOverlay text={videoText || content} />
      <CtaOverlay
        text="Plus d'infos"
        subtext={establishmentPhone || undefined}
        color={colors.primary}
      />
      {musicUrl && <MusicLayer url={musicUrl} />}
    </AbsoluteFill>
  )
}
