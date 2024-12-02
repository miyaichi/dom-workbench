import { PageConfig, TextConfig } from './types';

export const PAGE_CONFIG: PageConfig = {
  WIDTH: 595.28,
  HEIGHT: 841.89,
  MARGIN: 40,
  IMAGE_SCALE: 0.95,
};

export const TEXT_CONFIG: TextConfig = {
  margin: 50,
  lineHeight: 20,
  fontSize: 10,
  titleFontSize: 12,
  maxWidth: PAGE_CONFIG.WIDTH - 100,
};
