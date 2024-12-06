import { PaperSettings } from '../settings';
import { LayoutConfig, PPTConfig, StyleConfig, TextStyle } from './types';

export const styleConfig: StyleConfig = {
  title: {
    fontSize: 14,
    color: '363636',
    breakLine: true,
    bold: true,
    valign: 'top',
  } as TextStyle,
  content: {
    fontSize: 12,
    color: '666666',
    breakLine: true,
    valign: 'top',
  } as TextStyle,
};

export const createPPTConfig = (paperSettings: PaperSettings): PPTConfig => {
  if (paperSettings.size === 'a4') {
    // A4 dimensions in inches
    const baseWidth = 8.27;
    const baseHeight = 11.69;
    const [width, height] =
      paperSettings.orientation === 'landscape' ? [baseHeight, baseWidth] : [baseWidth, baseHeight];

    return {
      paper: paperSettings,
      layout: {
        width: width,
        height: height,
        padding: 0.05,
        contentPadding: 0.75,
        lineHeight: 0.4,
        imageScale: 0.9,
        maxContentHeight: height * 0.7,
      } as LayoutConfig,
      style: styleConfig,
    };
  }

  // 16:9 presentation
  const baseWidth = 10;
  const baseHeight = baseWidth * (9 / 16);
  const [width, height] =
    paperSettings.orientation === 'portrait' ? [baseHeight, baseWidth] : [baseWidth, baseHeight];

  return {
    paper: paperSettings,
    layout: {
      width: width,
      height: height,
      imageScale: 0.95,
      padding: 0.025,
      contentPadding: 0.5,
      lineHeight: 0.3,
      maxContentHeight: height * 0.7,
    } as LayoutConfig,
    style: styleConfig,
  };
};
