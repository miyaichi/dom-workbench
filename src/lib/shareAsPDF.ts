import { SharePayload } from '../types/types';
import { downloadFile } from '../utils/download';
import { formatTimestamp, generateFilename } from '../utils/formatters';
import { Logger } from './logger';
import {
  DocumentManager,
  FontManager,
  ImageManager,
  LayoutManager,
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

    // Create and initialize document manager
    const docManager = new DocumentManager();
    await docManager.initialize();
    const pdfDoc = docManager.getPDFDocument();

    //docManager.setPageSize(pageConfig.WIDTH, pageConfig.HEIGHT);
    docManager.setTitle(`Capture of ${url} at ${formatTimestamp(new Date())}`);

    const fonts = await FontManager.initialize(pdfDoc);
    const imageManager = new ImageManager(pageConfig);
    const layoutManager = new LayoutManager(pdfDoc, fonts, pageConfig, textConfig);

    const { image, dimensions } = await imageManager.processImage(pdfDoc, imageData);
    imageManager.createCapturePage(pdfDoc, image, dimensions);

    const now = new Date();
    await layoutManager.layoutContent([
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
