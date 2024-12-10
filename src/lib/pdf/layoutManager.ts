import { PDFDocument, PDFPage, rgb } from 'pdf-lib';
import { Config, FontConfig } from './types';

interface LineMetrics {
  text: string;
  width: number;
  height: number;
}

interface TextBlock {
  lines: string[];
  title?: string;
  fontSize: number;
  lineHeight: number;
}

export class LayoutManager {
  private readonly LINE_HEIGHT_RATIO = 1.2;
  private currentY: number;
  private readonly pageHeight: number;
  private readonly pageWidth: number;
  private readonly margin: number;

  constructor(
    private readonly pdfDoc: PDFDocument,
    private readonly fonts: FontConfig,
    private readonly config: Config
  ) {
    this.pageHeight = config.page.height;
    this.pageWidth = config.page.width;
    this.margin = config.page.margin;
    this.currentY = this.pageHeight - this.margin;
  }

  private measureText(text: string, fontSize: number): LineMetrics {
    try {
      const width = this.fonts.primary.widthOfTextAtSize(text, fontSize);
      return {
        text,
        width,
        height: fontSize * this.LINE_HEIGHT_RATIO,
      };
    } catch (error) {
      // Use fallback font if primary font does not support the text
      const width = this.fonts.fallback.widthOfTextAtSize(text, fontSize);
      return {
        text,
        width,
        height: fontSize * this.LINE_HEIGHT_RATIO,
      };
    }
  }

  private wrapTextToLines(text: string, maxWidth: number, fontSize: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const { width } = this.measureText(testLine, fontSize);

      if (width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  private async createNewPage(): Promise<PDFPage> {
    const page = this.pdfDoc.addPage([this.pageWidth, this.pageHeight]);
    this.currentY = this.pageHeight - this.margin;
    return page;
  }

  private calculateRequiredHeight(block: TextBlock): number {
    return (block.title ? block.lineHeight : 0) + block.lines.length * block.lineHeight;
  }

  private async drawTextLine(
    page: PDFPage,
    text: string,
    x: number,
    fontSize: number
  ): Promise<void> {
    const options = {
      x,
      y: this.currentY,
      size: fontSize,
      color: rgb(0, 0, 0),
    };

    try {
      page.drawText(text, { ...options, font: this.fonts.primary });
    } catch (e) {
      page.drawText(text, { ...options, font: this.fonts.fallback });
    }

    this.currentY -= fontSize * this.LINE_HEIGHT_RATIO;
  }

  public async layoutContent(sections: { title: string; content: string }[]): Promise<PDFPage[]> {
    const pages: PDFPage[] = [];
    let currentPage = await this.createNewPage();
    pages.push(currentPage);

    for (const section of sections) {
      if (!section.content) continue;

      const textBlock: TextBlock = {
        title: section.title,
        lines: this.wrapTextToLines(
          section.content,
          this.config.text.maxWidth,
          this.config.text.fontSize
        ),
        fontSize: this.config.text.fontSize,
        lineHeight: this.config.text.lineHeight,
      };

      const requiredHeight = this.calculateRequiredHeight(textBlock);
      if (this.currentY - requiredHeight < this.margin) {
        currentPage = await this.createNewPage();
        pages.push(currentPage);
      }

      if (textBlock.title) {
        await this.drawTextLine(
          currentPage,
          textBlock.title,
          this.margin,
          this.config.text.titleFontSize
        );
      }

      for (const line of textBlock.lines) {
        if (this.currentY - textBlock.lineHeight < this.margin) {
          currentPage = await this.createNewPage();
          pages.push(currentPage);
        }
        await this.drawTextLine(currentPage, line, this.margin, textBlock.fontSize);
      }

      this.currentY -= this.config.text.lineHeight;
    }

    return pages;
  }
}
