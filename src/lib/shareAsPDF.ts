import fontBytes from '@assets/fonts/NotoSansJP-Regular.otf';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { downloadFile } from '../utils/download';
import { formatTimestamp, generateFilename } from '../utils/formatters';
import { Logger } from './logger';

const logger = new Logger('shareAsPDF');

// Type definitions
type ImageDimensions = {
  width: number;
  height: number;
  x: number;
  y: number;
};

type FontConfig = {
  japanese: any; // Since PDFFont type requires import, use any as a substitute
  fallback: any;
};

type TextConfig = {
  margin: number;
  lineHeight: number;
  fontSize: number;
  titleFontSize: number;
  maxWidth: number;
};

// Constant values
const PAGE_CONFIG = {
  WIDTH: 595.28, // A4 width : 210mm x 297mm (points)
  HEIGHT: 841.89, // A4 height : 210mm x 297mm (points)
  MARGIN: 40, // Base margin (points)
  IMAGE_SCALE: 0.95, // Image maximum scale (95%)
};

const TEXT_CONFIG: TextConfig = {
  margin: 50,
  lineHeight: 20,
  fontSize: 10,
  titleFontSize: 12,
  maxWidth: PAGE_CONFIG.WIDTH - 100, // margin * 2
};

// Initialize fonts
const initializeFonts = async (pdfDoc: PDFDocument): Promise<FontConfig> => {
  logger.debug('Initializing fonts...');
  pdfDoc.registerFontkit(fontkit);

  const fonts = {
    japanese: await pdfDoc.embedFont(fontBytes, { subset: false }),
    fallback: await pdfDoc.embedFont(StandardFonts.Helvetica),
  };
  
  logger.debug('Fonts initialized successfully');
  return fonts;
};

const calculateImageDimensions = async (
  pdfDoc: PDFDocument,
  imageData: string
): Promise<{
  image: any;
  dimensions: ImageDimensions;
}> => {
  logger.debug('Processing image data for PDF...');
  
  const imageBytes = Uint8Array.from(atob(imageData.split(',')[1]), (c) => c.charCodeAt(0));
  const image = await pdfDoc.embedPng(imageBytes);
  const imageDims = image.scale(1);

  const availableWidth = PAGE_CONFIG.WIDTH - PAGE_CONFIG.MARGIN * 2;
  const availableHeight = PAGE_CONFIG.HEIGHT - PAGE_CONFIG.MARGIN * 2;

  const widthScale = availableWidth / imageDims.width;
  const heightScale = availableHeight / imageDims.height;
  const scale = Math.min(widthScale, heightScale) * PAGE_CONFIG.IMAGE_SCALE;

  const scaledWidth = imageDims.width * scale;
  const scaledHeight = imageDims.height * scale;

  const dimensions = {
    width: scaledWidth,
    height: scaledHeight,
    x: (PAGE_CONFIG.WIDTH - scaledWidth) / 2,
    y: (PAGE_CONFIG.HEIGHT - scaledHeight) / 2,
  };

  logger.debug('Image dimensions calculated', { 
    originalSize: { width: imageDims.width, height: imageDims.height },
    scaledSize: { width: scaledWidth, height: scaledHeight }
  });

  return { image, dimensions };
};

const wrapText = (text: string, font: any, maxWidth: number, fontSize: number): string[] => {
  logger.debug('Wrapping text to fit width', { maxWidth, fontSize });
  const lines: string[] = [];
  let remainingText = text;

  while (remainingText.length > 0) {
    let lineLength = remainingText.length;
    while (
      lineLength > 0 &&
      font.widthOfTextAtSize(remainingText.substring(0, lineLength), fontSize) > maxWidth
    ) {
      lineLength--;
    }

    const line = remainingText.substring(0, lineLength);
    lines.push(line);
    remainingText = remainingText.substring(lineLength).trim();
  }

  logger.debug(`Text wrapped into ${lines.length} lines`);
  return lines;
};

const drawText = (
  page: any,
  text: string,
  x: number,
  y: number,
  size: number,
  fonts: FontConfig
): void => {
  try {
    page.drawText(text, {
      x,
      y,
      size,
      font: fonts.japanese,
      color: rgb(0, 0, 0),
    });
  } catch (e) {
    logger.warn('Failed to use Japanese font, falling back to standard font', { text });
    page.drawText(text, {
      x,
      y,
      size,
      font: fonts.fallback,
      color: rgb(0, 0, 0),
    });
  }
};

const createImagePage = (
  pdfDoc: PDFDocument,
  image: Awaited<ReturnType<typeof PDFDocument.prototype.embedPng>>,
  dimensions: ImageDimensions
): PDFPage => {
  logger.debug('Creating image page');
  const page = pdfDoc.addPage([PAGE_CONFIG.WIDTH, PAGE_CONFIG.HEIGHT]);
  page.drawImage(image, dimensions);
  return page;
};

const layoutSection = (
  pdfDoc: PDFDocument,
  pages: PDFPage[],
  currentPage: PDFPage,
  section: { title: string; content: string },
  yOffset: number,
  fonts: FontConfig
): { page: PDFPage; yOffset: number } => {
  logger.debug('Laying out section', { title: section.title });
  let page = currentPage;

  if (shouldCreateNewPage(yOffset)) {
    logger.debug('Creating new page for section continuation');
    ({ page, yOffset } = createNewInfoPage(pdfDoc));
    pages.push(page);
  }

  drawText(page, section.title, TEXT_CONFIG.margin, yOffset, TEXT_CONFIG.titleFontSize, fonts);
  yOffset -= TEXT_CONFIG.lineHeight;

  const contentLines = wrapText(
    section.content,
    fonts.japanese,
    TEXT_CONFIG.maxWidth,
    TEXT_CONFIG.fontSize
  );

  for (const line of contentLines) {
    if (shouldCreateNewPage(yOffset)) {
      logger.debug('Creating new page for content continuation');
      ({ page, yOffset } = createNewInfoPage(pdfDoc));
      pages.push(page);
    }

    drawText(page, line, TEXT_CONFIG.margin, yOffset, TEXT_CONFIG.fontSize, fonts);
    yOffset -= TEXT_CONFIG.lineHeight;
  }

  return { page, yOffset: yOffset - TEXT_CONFIG.lineHeight };
};

const shouldCreateNewPage = (yOffset: number): boolean =>
  yOffset - TEXT_CONFIG.lineHeight < TEXT_CONFIG.margin;

const createNewInfoPage = (
  pdfDoc: PDFDocument
): {
  page: PDFPage;
  yOffset: number;
} => {
  const page = pdfDoc.addPage([PAGE_CONFIG.WIDTH, PAGE_CONFIG.HEIGHT]);
  const yOffset = PAGE_CONFIG.HEIGHT - TEXT_CONFIG.margin;
  return { page, yOffset };
};

const createInfoPage = (
  pdfDoc: PDFDocument,
  sections: { title: string; content: string }[],
  fonts: FontConfig
): PDFPage[] => {
  logger.debug('Creating information pages');
  const pages: PDFPage[] = [];
  let { page, yOffset } = createNewInfoPage(pdfDoc);
  pages.push(page);

  sections.forEach((section) => {
    ({ page, yOffset } = layoutSection(pdfDoc, pages, page, section, yOffset, fonts));
  });

  logger.debug(`Created ${pages.length} information pages`);
  return pages;
};

/**
 * Shares the content as a PDF document.
 * @param imageData - The image data to be included in the PDF.
 * @param comment - A comment to be included in the PDF.
 * @param url - The URL to be included in the PDF.
 * @param startTag - The start tag for the PDF content.
 * @param styleModifications - Style modifications to be applied to the PDF content.
 * @returns A promise that resolves to true if the PDF is successfully created.
 * @throws Will throw an error if imageData or url is not provided.
 */
export const shareAsPDF = async (
  imageData: string,
  comment: string,
  url: string,
  startTag: string,
  styleModifications: string
): Promise<true> => {
  logger.log('Starting PDF generation process');
  
  if (!imageData) {
    logger.error('PDF generation failed: Image data is missing');
    throw new Error('Image data is required');
  }
  if (!url) {
    logger.error('PDF generation failed: URL is missing');
    throw new Error('URL is required');
  }

  try {
    logger.log('Creating PDF document');
    const pdfDoc = await PDFDocument.create();
    
    logger.debug('Initializing fonts');
    const fonts = await initializeFonts(pdfDoc);
    
    logger.debug('Processing image');
    const { image, dimensions } = await calculateImageDimensions(pdfDoc, imageData);

    logger.log('Adding image page to PDF');
    createImagePage(pdfDoc, image, dimensions);

    const now = new Date();
    const sections = [
      { title: 'Date and time: ', content: formatTimestamp(now) },
      { title: 'URL: ', content: url },
      { title: 'Element start tag: ', content: startTag },
      { title: 'Comment: ', content: comment },
    ];

    logger.log('Adding information pages to PDF');
    createInfoPage(pdfDoc, sections, fonts);

    logger.debug('Generating final PDF bytes');
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: false,
      addDefaultPage: false,
    });

    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const filename = generateFilename(now, 'pdf');
    
    logger.log('Initiating PDF download', { filename });
    await downloadFile(pdfBlob, filename, {
      saveAs: false,
    });

    logger.log('PDF generation and download completed successfully');
    return true;
  } catch (error) {
    logger.error('PDF generation and download failed:', error);
    throw error;
  }
};
