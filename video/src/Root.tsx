import React from 'react';
import { Composition, Still } from 'remotion';
import './fonts';
import { MainPitchVideo } from './compositions/MainPitchVideo';
import { TeaserVerticalVideo } from './compositions/TeaserVerticalVideo';
import { ThumbnailStill } from './compositions/ThumbnailStill';
import {
  FPS,
  MAIN_TOTAL_FRAMES,
  TEASER_TOTAL_FRAMES,
  type VideoLang,
} from './storyboard';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MainPitch-EN"
        component={MainPitchVideo}
        durationInFrames={MAIN_TOTAL_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ lang: 'en' as VideoLang }}
      />
      <Composition
        id="MainPitch-AR"
        component={MainPitchVideo}
        durationInFrames={MAIN_TOTAL_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ lang: 'ar' as VideoLang }}
      />
      <Composition
        id="TeaserVertical-EN"
        component={TeaserVerticalVideo}
        durationInFrames={TEASER_TOTAL_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ lang: 'en' as VideoLang }}
      />
      <Composition
        id="TeaserVertical-AR"
        component={TeaserVerticalVideo}
        durationInFrames={TEASER_TOTAL_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ lang: 'ar' as VideoLang }}
      />
      <Still
        id="Thumbnail-16x9"
        component={ThumbnailStill}
        width={1920}
        height={1080}
      />
    </>
  );
};
