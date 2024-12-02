import { SlideStyleOptions } from './types';

export const SLIDE_CONFIG = {
  WIDTH: 10,
  HEIGHT: 5.625,
  IMAGE_SCALE: 0.95,
  MARGIN: 0.025,
  TEXT_MARGIN: 0.5,
  LINE_HEIGHT: 0.3,
  MAX_CONTENT_HEIGHT: 4,
} as const;

export const DEFAULTS = {
  MIME_TYPE: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  LAYOUT: 'LAYOUT_16x9',
} as const;

export const SlideStyle: Record<string, SlideStyleOptions> = {
  titleStyle: {
    fontSize: 14,
    color: '363636',
    breakLine: true,
    bold: true,
    valign: 'top',
  },
  contentStyle: {
    fontSize: 12,
    color: '666666',
    breakLine: true,
    valign: 'top',
  },
};
