import type pptxgen from 'pptxgenjs';
import { PaperOrientation, PaperSize } from '../settings';

export interface ImageDimensions {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SlideSection {
  title: string;
  content: string;
}

export interface TextBoxDimensions {
  x: number;
  y: number;
  width: number | string;
  height: number;
}

export interface TextStyle {
  fontSize: number;
  color: string;
  breakLine: boolean;
  bold?: boolean;
  valign?: pptxgen.VAlign;
}

export interface PaperConfig {
  readonly size: PaperSize;
  readonly orientation: PaperOrientation;
}

export interface LayoutConfig {
  readonly width: number;
  readonly height: number;
  readonly padding: number;
  readonly contentPadding: number;
  readonly lineHeight: number;
  readonly maxContentHeight: number;
  readonly imageScale: number;
}

export interface StyleConfig {
  readonly title: TextStyle;
  readonly content: TextStyle;
}

export interface Config {
  readonly paper: PaperConfig;
  readonly layout: LayoutConfig;
  readonly style: StyleConfig;
}
