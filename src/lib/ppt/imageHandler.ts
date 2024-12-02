import pptxgen from 'pptxgenjs';
import { Logger } from '../logger';
import { SLIDE_CONFIG } from './config';
import { ImageDimensions } from './types';

const logger = new Logger('pptImageHandler');

/**
 * Calculate image dimensions based on original size and slide constraints
 */
const calculateImageDimensions = (img: HTMLImageElement): ImageDimensions => {
  logger.debug('Calculating image dimensions', {
    originalSize: { width: img.width, height: img.height },
  });

  const imgRatio = img.width / img.height;
  const slideRatio = SLIDE_CONFIG.WIDTH / SLIDE_CONFIG.HEIGHT;
  const availableWidth = SLIDE_CONFIG.WIDTH * SLIDE_CONFIG.IMAGE_SCALE;
  const availableHeight = SLIDE_CONFIG.HEIGHT * SLIDE_CONFIG.IMAGE_SCALE;

  let width: number;
  let height: number;

  // Calculate dimensions maintaining aspect ratio
  if (imgRatio > slideRatio) {
    // Image is wider than slide ratio
    width = availableWidth;
    height = width / imgRatio;
  } else {
    // Image is taller than slide ratio
    height = availableHeight;
    width = height * imgRatio;
  }

  // Center the image on slide
  const x = (SLIDE_CONFIG.WIDTH - width) / 2;
  const y = (SLIDE_CONFIG.HEIGHT - height) / 2;

  const dimensions = { width, height, x, y };

  logger.debug('Image dimensions calculated', {
    scaledSize: { width, height },
    position: { x, y },
  });

  return dimensions;
};

/**
 * Convert base64 image data to dimensions
 */
export async function getImageDimensions(base64ImageData: string): Promise<ImageDimensions> {
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
        reject(new Error('Image dimension calculation failed'));
      }
    };

    img.onerror = () => {
      const error = new Error('Failed to load image');
      logger.error('Image loading failed');
      reject(error);
    };

    // Handle base64 image data with or without data URL prefix
    const imageSource = base64ImageData.startsWith('data:image/')
      ? base64ImageData
      : `data:image/png;base64,${base64ImageData}`;

    img.src = imageSource;
  });
}

/**
 * Validate image data format
 */
function validateImageData(imageData: string): boolean {
  try {
    if (!imageData) {
      throw new Error('Image data is empty');
    }

    // Check if it's already a data URL
    if (imageData.startsWith('data:image/')) {
      return true;
    }

    // Attempt to decode base64
    atob(imageData);
    return true;
  } catch (error) {
    logger.error('Invalid image data:', error);
    return false;
  }
}

/**
 * Create a slide with the screenshot
 */
export async function createScreenshotSlide(pres: pptxgen, imageData: string): Promise<void> {
  logger.debug('Creating screenshot slide');

  try {
    if (!validateImageData(imageData)) {
      throw new Error('Invalid image data format');
    }

    const slide = pres.addSlide();
    const imageDims = await getImageDimensions(imageData);

    // Ensure image data has proper format
    const processedImageData = imageData.startsWith('data:image/')
      ? imageData
      : `data:image/png;base64,${imageData}`;

    slide.addImage({
      data: processedImageData,
      x: imageDims.x,
      y: imageDims.y,
      w: imageDims.width,
      h: imageDims.height,
      sizing: {
        type: 'contain',
        w: imageDims.width,
        h: imageDims.height,
      },
    });

    logger.debug('Screenshot slide created successfully', {
      dimensions: imageDims,
    });
  } catch (error) {
    logger.error('Failed to create screenshot slide:', error);
    throw new Error('Screenshot slide creation failed');
  }
}

/**
 * Add image sizing metadata
 */
interface ImageMetadata {
  width: number;
  height: number;
  aspectRatio: number;
}

export function getImageMetadata(dimensions: ImageDimensions): ImageMetadata {
  return {
    width: dimensions.width,
    height: dimensions.height,
    aspectRatio: dimensions.width / dimensions.height,
  };
}
