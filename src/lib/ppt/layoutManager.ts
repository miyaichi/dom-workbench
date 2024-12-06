import pptxgen from 'pptxgenjs';
import { Logger } from '../logger';
import { Config, SlideSection, TextBoxDimensions, TextStyle } from './types';

const logger = new Logger('pptLayoutManager');

export class LayoutManager {
  private static readonly TEXT_WIDTH_RATIO = 0.95; // Ratio of text width to slide width
  private static readonly CHARS_PER_FONT_SIZE = 100; // Number of characters per font size
  private static readonly DEFAULT_CHARS_PER_FONT = 8; // Default number of characters per font size
  private static readonly TEXT_MARGIN = 0; // Margin for text boxes

  private readonly config: Config;
  private currentY: number;

  constructor(
    private readonly pres: pptxgen,
    config: Config
  ) {
    this.config = config;
    this.currentY = config.layout.contentPadding;
  }

  private calculateTextHeight(text: string, style: TextStyle): number {
    const charsPerLine = Math.floor(
      (this.config.layout.width - this.config.layout.contentPadding * 2) *
        (style.fontSize
          ? LayoutManager.CHARS_PER_FONT_SIZE / style.fontSize
          : LayoutManager.DEFAULT_CHARS_PER_FONT)
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
        typeof dimensions.width === 'string'
          ? (Number(dimensions.width.replace('%', '')) / 100) * this.config.layout.width
          : dimensions.width,
      h: dimensions.height,
      valign: style.valign || 'top',
      margin: LayoutManager.TEXT_MARGIN,
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

      // Create title text box
      this.createTextBox(currentSlide, section.title, this.config.style.title, {
        x: this.config.layout.contentPadding,
        y: this.currentY,
        width: this.config.layout.width * LayoutManager.TEXT_WIDTH_RATIO,
        height: titleHeight,
      });

      this.currentY += titleHeight;

      // Create content text box
      this.createTextBox(currentSlide, section.content, this.config.style.content, {
        x: this.config.layout.contentPadding,
        y: this.currentY,
        width: this.config.layout.width * LayoutManager.TEXT_WIDTH_RATIO,
        height: contentHeight,
      });

      this.currentY += contentHeight + this.config.layout.lineHeight;
    });

    logger.debug('Section layout completed');
  }
}
