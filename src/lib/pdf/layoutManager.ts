import { PDFDocument, PDFPage, rgb } from 'pdf-lib';
import { FontConfig, PageConfig, TextConfig } from './types';

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
  private currentY: number;
  private readonly pageHeight: number;
  private readonly pageWidth: number;
  private readonly margin: number;
  private readonly textConfig: TextConfig;

  constructor(
    private readonly pdfDoc: PDFDocument,
    private readonly fonts: FontConfig,
    pageConfig: PageConfig,
    textConfig: TextConfig
  ) {
    this.pageHeight = pageConfig.height;
    this.pageWidth = pageConfig.width;
    this.margin = pageConfig.margin;
    this.textConfig = textConfig;
    this.currentY = this.pageHeight - this.margin;
  }

  private measureText(text: string, fontSize: number): LineMetrics {
    const width = this.fonts.japanese.widthOfTextAtSize(text, fontSize);
    const height = fontSize * 1.2; // Approximate height with leading
    return { text, width, height };
  }

  private wrapTextToLines(text: string, maxWidth: number, fontSize: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = this.measureText(testLine, fontSize);

      if (metrics.width <= maxWidth) {
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
    let height = 0;
    if (block.title) {
      height += block.lineHeight;
    }
    height += block.lines.length * block.lineHeight;
    return height;
  }

  private async drawTextLine(
    page: PDFPage,
    text: string,
    x: number,
    fontSize: number
  ): Promise<void> {
    try {
      page.drawText(text, {
        x,
        y: this.currentY,
        size: fontSize,
        font: this.fonts.japanese,
        color: rgb(0, 0, 0),
      });
    } catch (e) {
      page.drawText(text, {
        x,
        y: this.currentY,
        size: fontSize,
        font: this.fonts.fallback,
        color: rgb(0, 0, 0),
      });
    }
    this.currentY -= fontSize * 1.2;
  }

  public async layoutContent(sections: { title: string; content: string }[]): Promise<PDFPage[]> {
    const pages: PDFPage[] = [];
    let currentPage = await this.createNewPage();
    pages.push(currentPage);

    for (const section of sections) {
      // Prepare text blocks
      const textBlock: TextBlock = {
        title: section.title,
        lines: this.wrapTextToLines(
          section.content,
          this.textConfig.maxWidth,
          this.textConfig.fontSize
        ),
        fontSize: this.textConfig.fontSize,
        lineHeight: this.textConfig.lineHeight,
      };

      // Calculate if we need a new page
      const requiredHeight = this.calculateRequiredHeight(textBlock);
      if (this.currentY - requiredHeight < this.margin) {
        currentPage = await this.createNewPage();
        pages.push(currentPage);
      }

      // Draw title if exists
      if (textBlock.title) {
        await this.drawTextLine(
          currentPage,
          textBlock.title,
          this.margin,
          this.textConfig.titleFontSize
        );
      }

      // Draw content lines
      for (const line of textBlock.lines) {
        if (this.currentY - textBlock.lineHeight < this.margin) {
          currentPage = await this.createNewPage();
          pages.push(currentPage);
        }
        await this.drawTextLine(currentPage, line, this.margin, textBlock.fontSize);
      }

      // Add extra space between sections
      this.currentY -= this.textConfig.lineHeight;
    }

    return pages;
  }
}

export const createInfoPage = async (
  pdfDoc: PDFDocument,
  sections: { title: string; content: string }[],
  fonts: FontConfig,
  pageConfig: PageConfig,
  textConfig: TextConfig
): Promise<PDFPage[]> => {
  const layoutManager = new LayoutManager(pdfDoc, fonts, pageConfig, textConfig);
  return await layoutManager.layoutContent(sections);
};
