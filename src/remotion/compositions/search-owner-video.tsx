import { AbsoluteFill } from 'remotion'
import { Background } from '../components/background'
import { LogoWatermark } from '../components/logo-watermark'
import { AnimalPhoto } from '../components/animal-photo'
import { TitleOverlay, ContentOverlay, CtaOverlay } from '../components/text-overlay'
import { MusicLayer } from '../components/music-layer'
import { POST_TYPE_COLORS, type VideoProps } from '../types'

export function SearchOwnerVideo({ animalName, photoUrls, content, establishmentName, establishmentPhone, logoUrl, videoText, musicUrl }: VideoProps) {
  const colors = POST_TYPE_COLORS.search_owner

  return (
    <AbsoluteFill>
      <Background gradient={colors.gradient} />
      <LogoWatermark name={establishmentName} color={colors.primary} logoUrl={logoUrl} />
      <TitleOverlay
        text={animalName ? `${animalName} - RECHERCHE PROPRIETAIRE` : 'RECHERCHE PROPRIETAIRE'}
        color={colors.primary}
      />
      {photoUrls[0] && <AnimalPhoto url={photoUrls[0]} />}
      <ContentOverlay text={videoText || content} />
      <CtaOverlay
        text="Contactez-nous"
        subtext={establishmentPhone || undefined}
        color={colors.primary}
      />
      {musicUrl && <MusicLayer url={musicUrl} />}
    </AbsoluteFill>
  )
}
