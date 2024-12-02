import { downloadFile } from '../utils/download';
import { formatTimestamp, generateFilename } from '../utils/formatters';
import { Logger } from './logger';
import {
  PAGE_CONFIG,
  PDFDocumentManager,
  PDFFontManager,
  PDFImageManager,
  TEXT_CONFIG,
  TextLayoutManager,
} from './pdf';

const logger = new Logger('sharePDF');

export const shareAsPDF = async (
  imageData: string,
  url: string,
  startTag: string,
  comment: string,
  styleChanges: string,
  injectedTags: string
): Promise<true> => {
  logger.log('Starting PDF generation process');

  if (!imageData || !url) {
    throw new Error('Image data and URL are required');
  }

  try {
    // Create and initialize document manager
    const docManager = new PDFDocumentManager();
    await docManager.initialize();
    const pdfDoc = docManager.getPDFDocument();

    docManager.setTitle(`Screenshot of ${url} at ${formatTimestamp(new Date())}`);

    const fonts = await PDFFontManager.initialize(pdfDoc);
    const imageManager = new PDFImageManager(PAGE_CONFIG);
    const textManager = new TextLayoutManager(pdfDoc, fonts, PAGE_CONFIG, TEXT_CONFIG);

    const { image, dimensions } = await imageManager.processImage(pdfDoc, imageData);
    imageManager.createPage(pdfDoc, image, dimensions);

    const now = new Date();
    await textManager.layoutContent([
      { title: 'Date and time: ', content: formatTimestamp(now) },
      { title: 'URL: ', content: url },
      { title: 'Element start tag: ', content: startTag },
      { title: 'Comment: ', content: comment },
      { title: 'Style changes: ', content: styleChanges },
      { title: 'Injected tags: ', content: injectedTags },
    ]);

    const pdfBytes = await docManager.save();
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    await downloadFile(pdfBlob, generateFilename(now, 'pdf'), { saveAs: false });
    return true;
  } catch (error) {
    logger.error('PDF generation failed:', error);
    throw error;
  }
};
