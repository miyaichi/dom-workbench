import pptxgen from 'pptxgenjs';
import { downloadFile } from '../utils/download';
import { formatTimestamp, generateFilename } from '../utils/formatters';
import { Logger } from './logger';
import {
  createScreenshotSlide,
  DEFAULTS,
  generatePPTX,
  PPTLayoutManager,
  SlideSection,
} from './ppt';

const logger = new Logger('sharePPT');

export const shareAsPPT = async (
  imageData: string,
  url: string,
  startTag: string,
  comment: string,
  styleChanges: string,
  injectedTags: string
): Promise<true> => {
  logger.log('Starting PowerPoint generation process');

  if (!imageData || !url) {
    throw new Error('Image data and URL are required');
  }

  try {
    const manifest = chrome.runtime.getManifest();
    const pres = new pptxgen();
    pres.author = `${manifest.name} v${manifest.version}`;
    pres.title = `Screenshot of ${url} at ${formatTimestamp(new Date())}`;
    pres.layout = DEFAULTS.LAYOUT;

    await createScreenshotSlide(pres, imageData);

    const layoutManager = new PPTLayoutManager(pres);
    const now = new Date();
    const sections: SlideSection[] = [
      { title: 'Date and time: ', content: formatTimestamp(now) },
      { title: 'URL: ', content: url },
      { title: 'Element start tag: ', content: startTag },
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
