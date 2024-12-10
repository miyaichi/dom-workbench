import { SharePayload } from '../types/types';
import { downloadFile } from '../utils/download';
import { formatTimestamp, generateFilename } from '../utils/formatters';
import { Logger } from './logger';
import { createConfig, DocumentManager, ImageManager, LayoutManager, SlideSection } from './ppt';

const logger = new Logger('sharePPT');

export const shareAsPPT = async ({
  imageData,
  url,
  html,
  comment,
  styleChanges,
  injectedTags,
  paperSettings,
}: SharePayload): Promise<true> => {
  logger.info('Starting PowerPoint generation process');

  if (!imageData) {
    throw new Error('Capture data is required but was not provided');
  }
  if (!url) {
    throw new Error('Target URL is required but was not provided');
  }

  try {
    const config = createConfig(paperSettings);
    const docManager = new DocumentManager(config, url);
    const pres = docManager.getPPTDocument();

    const layoutManager = new LayoutManager(pres, config);
    const imageManager = new ImageManager(pres, config);

    await imageManager.createCaptureSlide(imageData);

    const now = new Date();
    const sections: SlideSection[] = [
      { title: 'Date and time: ', content: formatTimestamp(now) },
      { title: 'URL: ', content: url },
      { title: 'Element: ', content: html },
      { title: 'Comment: ', content: comment },
      { title: 'Style changes: ', content: styleChanges },
      { title: 'Injected tags: ', content: injectedTags },
    ];
    layoutManager.layoutSections(sections);

    const pptxBlob = await docManager.save();
    const filename = generateFilename(now, 'pptx');
    logger.debug('PowerPoint file prepared', { filename });

    await downloadFile(pptxBlob, filename, { saveAs: false });
    return true;
  } catch (error) {
    logger.error('PowerPoint generation and download failed:', error);
    throw error;
  }
};
