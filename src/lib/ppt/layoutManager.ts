import pptxgen from 'pptxgenjs';
import { Logger } from '../logger';
import { PPTConfig, SlideSection, TextBoxDimensions, TextStyle } from './types';

const logger = new Logger('pptLayoutManager');

export class PPTLayoutManager {
  private readonly config: PPTConfig;
  private currentY: number;

  constructor(
    private readonly pres: pptxgen,
    config: PPTConfig
  ) {
    this.config = config;
    this.currentY = config.layout.contentPadding;
  }

  private calculateTextHeight(text: string, style: TextStyle): number {
    const charsPerLine = Math.floor(
      (this.config.layout.width - this.config.layout.contentPadding * 2) *
        (style.fontSize ? 100 / style.fontSize : 8)
    );
    const lines = Math.ceil(text.length / charsPerLine);
    return lines * this.config.layout.lineHeight;
  }

  private needsNewSlide(textHeight: number): boolean {
    return this.currentY + textHeight > this.config.layout.maxContentHeight;
  }

  private createTextBox(
    slide: pptxgen.Slide,
    text: string,
    style: TextStyle,
    dimensions: TextBoxDimensions
  ): void {
    slide.addText([{ text, options: style }], {
      x: dimensions.x,
      y: dimensions.y,
      w:
        typeof dimensions.w === 'string'
          ? (Number(dimensions.w.replace('%', '')) / 100) * this.config.layout.width
          : dimensions.w,
      h: dimensions.h,
      valign: style.valign || 'top',
      margin: 0,
    });
  }

  public layoutSections(sections: SlideSection[]): void {
    logger.debug('Starting section layout');
    let currentSlide = this.pres.addSlide();

    sections.forEach((section) => {
      const titleHeight = this.calculateTextHeight(section.title, this.config.style.title);
      const contentHeight = this.calculateTextHeight(section.content, this.config.style.content);
      const totalHeight = titleHeight + contentHeight;

      if (this.needsNewSlide(totalHeight)) {
        currentSlide = this.pres.addSlide();
        this.currentY = this.config.layout.contentPadding;
      }

      this.createTextBox(currentSlide, section.title, this.config.style.title, {
        x: this.config.layout.contentPadding,
        y: this.currentY,
        w: this.config.layout.width * 0.95, // 95%をnumberに変換
        h: titleHeight,
      });

      this.currentY += titleHeight;

      this.createTextBox(currentSlide, section.content, this.config.style.content, {
        x: this.config.layout.contentPadding,
        y: this.currentY,
        w: this.config.layout.width * 0.95, // 95%をnumberに変換
        h: contentHeight,
      });

      this.currentY += contentHeight + this.config.layout.lineHeight;
    });

    logger.debug('Section layout completed');
  }
}