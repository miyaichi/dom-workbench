import { PaperSettings } from '../settings';
import { PageConfig, TextConfig } from './types';

const A4_DIMENSIONS = {
  WIDTH: 595.28,
  HEIGHT: 841.89,
};

const PRESENTATION_DIMENSIONS = {
  WIDTH: 960,
  HEIGHT: 540,
};

export const createPageConfig = (paperSettings: PaperSettings): PageConfig => {
  let width: number;
  let height: number;

  if (paperSettings.size === 'a4') {
    width = A4_DIMENSIONS.WIDTH;
    height = A4_DIMENSIONS.HEIGHT;
  } else {
    width = PRESENTATION_DIMENSIONS.WIDTH;
    height = PRESENTATION_DIMENSIONS.HEIGHT;
  }

  if (paperSettings.orientation === 'landscape') {
    [width, height] = [height, width];
  }

  const margin = Math.min(width, height) * 0.05;

  return {
    WIDTH: width,
    HEIGHT: height,
    MARGIN: margin,
    IMAGE_SCALE: 0.95,
  };
};

export const createTextConfig = (pageConfig: PageConfig): TextConfig => {
  const baseFontSize = Math.min(pageConfig.WIDTH, pageConfig.HEIGHT) * 0.012;

  return {
    margin: pageConfig.MARGIN + 10,
    lineHeight: baseFontSize * 1.5,
    fontSize: baseFontSize,
    titleFontSize: baseFontSize * 1.2,
    maxWidth: pageConfig.WIDTH - pageConfig.MARGIN * 2,
  };
};
