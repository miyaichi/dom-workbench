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

export interface SlideStyleOptions {
  fontSize: number;
  color: string;
  breakLine: boolean;
  bold?: boolean;
  valign?: pptxgen.VAlign;
}
