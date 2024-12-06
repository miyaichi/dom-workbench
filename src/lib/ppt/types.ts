import type pptxgen from 'pptxgenjs';

export interface ImageDimensions {
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface SlideSection {
  title: string;
  content: string;
}

export interface TextBoxDimensions {
  x: number;
  y: number;
  w: number | string;
  h: number;
}

export interface TextStyle {
  fontSize: number;
  color: string;
  breakLine: boolean;
  bold?: boolean;
  valign?: pptxgen.VAlign;
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

export interface PPTConfig {
  layout: LayoutConfig;
  style: StyleConfig;
}