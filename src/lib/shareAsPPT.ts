import pptxgen from 'pptxgenjs';
import { SharePayload } from '../types/types';
import { downloadFile } from '../utils/download';
import { formatTimestamp, generateFilename } from '../utils/formatters';
import { Logger } from './logger';
import {
  createSlideConfig,
  DEFAULTS,
  generatePPTX,
  PPTImageManager,
  PPTLayoutManager,
  SlideSection,
} from './ppt';

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

  if (!imageData || !url) {
    throw new Error('Image data and URL are required');
  }

  try {
    // Create slide configuration
    const slideConfig = createSlideConfig(paperSettings);

    // Create and initialize presentation
    const pres = new pptxgen();
    const manifest = chrome.runtime.getManifest();
    pres.author = `${manifest.name} v${manifest.version}`;
    pres.title = `Screenshot of ${url} at ${formatTimestamp(new Date())}`;
    pres.layout = DEFAULTS.LAYOUT;

    // Create and initialize layout and image managers
    const layoutManager = new PPTLayoutManager(pres, slideConfig);
    const imageManager = new PPTImageManager(pres, slideConfig);

    await imageManager.createScreenshotSlide(imageData);

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

    const pptxOutput = await pres.write({ outputType: 'base64' });
    if (typeof pptxOutput !== 'string') {
      throw new Error('PowerPoint generation failed: Invalid output type');
    }

    const pptxBlob = await generatePPTX(pptxOutput);
    const filename = generateFilename(now, 'pptx');

    await downloadFile(pptxBlob, filename, { saveAs: false });
    return true;
  } catch (error) {
    logger.error('PowerPoint generation and download failed:', error);
    throw error;
  }
};
