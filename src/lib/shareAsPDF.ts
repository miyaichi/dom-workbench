import { SharePayload } from '../types/types';
import { downloadFile } from '../utils/download';
import { formatTimestamp, generateFilename } from '../utils/formatters';
import { Logger } from './logger';
import {
  PDFDocumentManager,
  PDFFontManager,
  PDFImageManager,
  TextLayoutManager,
  createPageConfig,
  createTextConfig,
} from './pdf';

const logger = new Logger('sharePDF');

export const shareAsPDF = async ({
  imageData,
  url,
  html,
  comment,
  styleChanges,
  injectedTags,
  paperSettings,
}: SharePayload): Promise<true> => {
  logger.info('Starting PDF generation process');

  if (!imageData || !url) {
    throw new Error('Image data and URL are required');
  }

  try {
    // Create page and text configurations
    const pageConfig = createPageConfig(paperSettings);
    const textConfig = createTextConfig(pageConfig);

    logger.debug('Using page configuration:', {
      size: `${pageConfig.WIDTH}x${pageConfig.HEIGHT}`,
      orientation: paperSettings.orientation,
    });

    // Create and initialize document manager
    const docManager = new PDFDocumentManager();
    await docManager.initialize();
    const pdfDoc = docManager.getPDFDocument();

    //docManager.setPageSize(pageConfig.WIDTH, pageConfig.HEIGHT);
    docManager.setTitle(`Screenshot of ${url} at ${formatTimestamp(new Date())}`);

    const fonts = await PDFFontManager.initialize(pdfDoc);
    const imageManager = new PDFImageManager(pageConfig);
    const textManager = new TextLayoutManager(pdfDoc, fonts, pageConfig, textConfig);

    const { image, dimensions } = await imageManager.processImage(pdfDoc, imageData);
    imageManager.createPage(pdfDoc, image, dimensions);

    const now = new Date();
    await textManager.layoutContent([
      { title: 'Date and time: ', content: formatTimestamp(now) },
      { title: 'URL: ', content: url },
      { title: 'Element: ', content: html },
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
