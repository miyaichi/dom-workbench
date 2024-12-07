import { PaperSettings } from '../settings';
import { PageConfig, TextConfig } from './types';

export const createConfig = (paperSettings: PaperSettings) => {
  const [baseWidth, baseHeight] = paperSettings.size === 'a4' ? [595.28, 841.89] : [540, 960];
  const [width, height] =
    paperSettings.orientation === 'landscape' ? [baseHeight, baseWidth] : [baseWidth, baseHeight];
  const margin = Math.min(width, height) * 0.05;
  const baseFontSize = Math.min(width, height) * 0.012;

  return {
    paper: paperSettings,
    page: {
      width: width,
      height: height,
      margin: margin,
      imageScale: 0.95,
    } as PageConfig,
    text: {
      margin: margin + 10,
      lineHeight: baseFontSize * 1.5,
      fontSize: baseFontSize,
      titleFontSize: baseFontSize * 1.2,
      maxWidth: width - margin * 2,
    } as TextConfig,
  };
};
