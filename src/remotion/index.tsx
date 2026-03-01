import React from 'react'
import { Composition } from 'remotion'
import { AdoptionVideo } from './compositions/adoption-video'
import { SearchOwnerVideo } from './compositions/search-owner-video'
import { EventVideo } from './compositions/event-video'
import { InfoVideo } from './compositions/info-video'
import { OtherVideo } from './compositions/other-video'
import { VIDEO_WIDTH, VIDEO_HEIGHT, VIDEO_FPS, VIDEO_DURATION_FRAMES, type VideoProps } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComp = React.ComponentType<any>

const defaultProps = {
  postType: 'adoption',
  animalName: 'Luna',
  animalSpecies: 'cat',
  photoUrls: [],
  content: 'Decouvrez notre animal a l\'adoption !',
  establishmentName: 'Refuge SDA',
  establishmentPhone: '',
} satisfies VideoProps

const shared = {
  width: VIDEO_WIDTH,
  height: VIDEO_HEIGHT,
  fps: VIDEO_FPS,
  durationInFrames: VIDEO_DURATION_FRAMES,
  defaultProps: defaultProps as unknown as Record<string, unknown>,
}

export function RemotionRoot() {
  return (
    <>
      <Composition id="adoption" component={AdoptionVideo as AnyComp} {...shared} />
      <Composition id="search_owner" component={SearchOwnerVideo as AnyComp} {...shared} />
      <Composition id="event" component={EventVideo as AnyComp} {...shared} />
      <Composition id="info" component={InfoVideo as AnyComp} {...shared} />
      <Composition id="other" component={OtherVideo as AnyComp} {...shared} />
    </>
  )
}

// Map post type to composition component for Player usage
export const COMPOSITION_MAP = {
  adoption: AdoptionVideo,
  search_owner: SearchOwnerVideo,
  event: EventVideo,
  info: InfoVideo,
  other: OtherVideo,
} as const
