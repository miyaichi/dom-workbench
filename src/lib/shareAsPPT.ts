import pptxgen from 'pptxgenjs';
import { downloadFile } from '../utils/download';
import { formatTimestamp, generateFilename } from '../utils/formatters';
import { Logger } from './logger';

const logger = new Logger('shareAsPPT');

interface ImageDimensions {
  width: number;
  height: number;
  x: number;
  y: number;
}

interface SlideSection {
  title: string;
  content: string;
}

interface SlideStyleOptions {
  fontSize: number;
  color: string;
  breakLine: boolean;
  bold?: boolean;
}

const SLIDE_CONFIG = {
  WIDTH: 10,
  HEIGHT: 5.625,
  IMAGE_SCALE: 0.95,
  MARGIN: 0.025,
  TEXT_MARGIN: 0.5,
} as const;

const DEFAULTS = {
  MIME_TYPE: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  LAYOUT: 'LAYOUT_16x9',
} as const;

const SlideStyle: Record<string, SlideStyleOptions> = {
  titleStyle: { fontSize: 14, color: '363636', breakLine: true, bold: true },
  contentStyle: { fontSize: 12, color: '666666', breakLine: true },
  spaceStyle: { fontSize: 8, color: '666666', breakLine: true },
};

const calculateImageDimensions = (img: HTMLImageElement): ImageDimensions => {
  logger.debug('Calculating image dimensions', {
    originalSize: { width: img.width, height: img.height }
  });

  const imgRatio = img.width / img.height;
  const slideRatio = SLIDE_CONFIG.WIDTH / SLIDE_CONFIG.HEIGHT;
  const availableWidth = SLIDE_CONFIG.WIDTH * SLIDE_CONFIG.IMAGE_SCALE;
  const availableHeight = SLIDE_CONFIG.HEIGHT * SLIDE_CONFIG.IMAGE_SCALE;

  let width: number;
  let height: number;

  if (imgRatio > slideRatio) {
    width = availableWidth;
    height = width / imgRatio;
  } else {
    height = availableHeight;
    width = height * imgRatio;
  }

  const x = (SLIDE_CONFIG.WIDTH - width) / 2;
  const y = (SLIDE_CONFIG.HEIGHT - height) / 2;

  const dimensions = { width, height, x, y };
  logger.debug('Image dimensions calculated', {
    scaledSize: { width, height },
    position: { x, y }
  });

  return dimensions;
};

const getImageDimensions = (base64ImageData: string): Promise<ImageDimensions> => {
  logger.debug('Starting image dimension calculation');
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const dimensions = calculateImageDimensions(img);
        logger.debug('Image dimensions retrieved successfully');
        resolve(dimensions);
      } catch (error) {
        logger.error('Failed to calculate image dimensions:', error);
        reject(error);
      }
    };
    img.onerror = () => {
      const error = new Error('Failed to load image');
      logger.error('Image loading failed');
      reject(error);
    };
    img.src = base64ImageData;
  });
};

const generatePPTX = async (pptxData: string): Promise<Blob> => {
  logger.debug('Generating PPTX blob from base64 data');
  try {
    const byteCharacters = atob(pptxData);
    const byteArray = new Uint8Array(byteCharacters.split('').map((char) => char.charCodeAt(0)));
    const blob = new Blob([byteArray], { type: DEFAULTS.MIME_TYPE });
    logger.debug('PPTX blob generated successfully', {
      size: blob.size
    });
    return blob;
  } catch (error) {
    logger.error('Failed to generate PPTX blob:', error);
    throw error;
  }
};

const createScreenshotSlide = async (pres: pptxgen, imageData: string) => {
  logger.debug('Creating screenshot slide');
  try {
    const slide = pres.addSlide();
    const imageDims = await getImageDimensions(imageData);
    
    slide.addImage({
      data: imageData,
      x: imageDims.x,
      y: imageDims.y,
      w: imageDims.width,
      h: imageDims.height,
    });
    
    logger.debug('Screenshot slide created successfully');
  } catch (error) {
    logger.error('Failed to create screenshot slide:', error);
    throw error;
  }
};

const createInfoSlide = (pres: pptxgen, sections: SlideSection[]) => {
  logger.debug('Creating information slide', {
    sectionCount: sections.length
  });

  try {
    const slide = pres.addSlide();
    const texts = sections.map((section) => [
      { text: section.title, options: SlideStyle.titleStyle },
      { text: section.content, options: SlideStyle.contentStyle },
    ]);

    slide.addText(texts.flat(), {
      x: SLIDE_CONFIG.TEXT_MARGIN,
      y: SLIDE_CONFIG.TEXT_MARGIN,
      w: '95%',
      h: '90%',
      valign: 'top',
      margin: 10,
    });

    logger.debug('Information slide created successfully');
  } catch (error) {
    logger.error('Failed to create information slide:', error);
    throw error;
  }
};

/**
 * Shares the content as a PPT document.
 * @param imageData - The image data to be included in the PPT.
 * @param comment - A comment to be included in the PPT.
 * @param url - The URL to be included in the PPT.
 * @param startTag - The start tag for the PPT content.
 * @param styleModifications - Style modifications to be applied to the PPT content.
 * @returns A promise that resolves to true if the PPT is successfully created.
 * @throws Will throw an error if imageData or url is not provided.
 */
export const shareAsPPT = async (
  imageData: string,
  comment: string,
  url: string,
  startTag: string,
  styleModifications: string
): Promise<true> => {
  logger.log('Starting PowerPoint generation process');

  if (!imageData) {
    logger.error('PowerPoint generation failed: Image data is missing');
    throw new Error('Image data is required');
  }
  if (!url) {
    logger.error('PowerPoint generation failed: URL is missing');
    throw new Error('URL is required');
  }

  try {
    logger.log('Initializing PowerPoint presentation');
    const pres = new pptxgen();
    pres.layout = DEFAULTS.LAYOUT;

    logger.debug('Processing image data');
    const base64ImageData = imageData.startsWith('data:image/')
      ? imageData
      : `data:image/png;base64,${imageData}`;

    logger.log('Creating screenshot slide');
    await createScreenshotSlide(pres, base64ImageData);

    const now = new Date();
    const sections: SlideSection[] = [
      { title: 'Date and time: ', content: formatTimestamp(now) },
      { title: 'URL: ', content: url },
      { title: 'Element start tag: ', content: startTag },
      { title: 'Comment: ', content: comment },
    ];

    logger.log('Creating information slide');
    createInfoSlide(pres, sections);

    logger.debug('Generating PowerPoint output');
    const pptxOutput = await pres.write({ outputType: 'base64' });
    if (typeof pptxOutput !== 'string') {
      const error = new Error('PowerPoint generation failed: Invalid output type');
      logger.error(error.message);
      throw error;
    }

    logger.debug('Converting PowerPoint to downloadable format');
    const pptxBlob = await generatePPTX(pptxOutput);
    
    const filename = generateFilename(now, 'pptx');
    logger.log('Initiating PowerPoint download', { filename });
    await downloadFile(pptxBlob, filename, {
      saveAs: false,
    });

    logger.log('PowerPoint generation and download completed successfully');
    return true;
  } catch (error) {
    logger.error('PowerPoint generation and download failed:', error);
    throw error;
  }
};
