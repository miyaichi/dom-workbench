import pptxgen from 'pptxgenjs';
import { Logger } from '../logger';
import { SlideStyle } from './config';
import { SlideConfig, SlideSection, SlideStyleOptions, TextBoxDimensions } from './types';

const logger = new Logger('pptLayoutManager');

export class PPTLayoutManager {
  private readonly slideConfig: SlideConfig;
  private currentY: number;

  constructor(
    private readonly pres: pptxgen,
    slideConfig: SlideConfig
  ) {
    this.slideConfig = slideConfig;
    this.currentY = slideConfig.TEXT_MARGIN;
  }

  private calculateTextHeight(text: string, style: SlideStyleOptions): number {
    const charsPerLine = Math.floor(
      (this.slideConfig.WIDTH - this.slideConfig.TEXT_MARGIN * 2) *
        (style.fontSize ? 100 / style.fontSize : 8)
    );
    const lines = Math.ceil(text.length / charsPerLine);
    return lines * this.slideConfig.LINE_HEIGHT;
  }

  private needsNewSlide(textHeight: number): boolean {
    return this.currentY + textHeight > this.slideConfig.MAX_CONTENT_HEIGHT;
  }

  private createTextBox(
    slide: pptxgen.Slide,
    text: string,
    style: SlideStyleOptions,
    dimensions: TextBoxDimensions
  ): void {
    slide.addText([{ text, options: style }], {
      x: dimensions.x,
      y: dimensions.y,
      w:
        typeof dimensions.w === 'string'
          ? (Number(dimensions.w.replace('%', '')) / 100) * this.slideConfig.WIDTH
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
      const titleHeight = this.calculateTextHeight(section.title, SlideStyle.titleStyle);
      const contentHeight = this.calculateTextHeight(section.content, SlideStyle.contentStyle);
      const totalHeight = titleHeight + contentHeight;

      if (this.needsNewSlide(totalHeight)) {
        currentSlide = this.pres.addSlide();
        this.currentY = this.slideConfig.TEXT_MARGIN;
      }

      this.createTextBox(currentSlide, section.title, SlideStyle.titleStyle, {
        x: this.slideConfig.TEXT_MARGIN,
        y: this.currentY,
        w: this.slideConfig.WIDTH * 0.95, // 95%をnumberに変換
        h: titleHeight,
      });

      this.currentY += titleHeight;

      this.createTextBox(currentSlide, section.content, SlideStyle.contentStyle, {
        x: this.slideConfig.TEXT_MARGIN,
        y: this.currentY,
        w: this.slideConfig.WIDTH * 0.95, // 95%をnumberに変換
        h: contentHeight,
      });

      this.currentY += contentHeight + this.slideConfig.LINE_HEIGHT;
    });

    logger.debug('Section layout completed');
  }
}
