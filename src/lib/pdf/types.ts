import { PaperOrientation, PaperSize } from '../settings';

export interface ImageDimensions {
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface FontConfig {
  primary: any;
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
  width: number;
  height: number;
  margin: number;
  imageScale: number;
}

export interface PaperConfig {
  readonly size: PaperSize;
  readonly orientation: PaperOrientation;
}

export interface Config {
  paper: PaperConfig;
  page: PageConfig;
  text: TextConfig;
}
