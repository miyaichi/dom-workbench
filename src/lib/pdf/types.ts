export interface ImageDimensions {
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface FontConfig {
  japanese: any;
  fallback: any;
}

export interface TextConfig {
  margin: number;
  lineHeight: number;
  fontSize: number;
  titleFontSize: number;
  maxWidth: number;
}

export interface PageConfig {
  WIDTH: number;
  HEIGHT: number;
  MARGIN: number;
  IMAGE_SCALE: number;
}
