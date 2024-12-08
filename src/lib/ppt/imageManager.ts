import pptxgen from 'pptxgenjs';
import { Logger } from '../logger';
import { Config, ImageDimensions } from './types';

const logger = new Logger('pptImageManager');

// Calculate the optimal image layout based on the slide layout and the image aspect ratio
const calculateOptimalImageLayout = (
  originalWidth: number,
  originalHeight: number,
  slideLayout: Config['layout']
): ImageDimensions => {
  const aspectRatio = originalWidth / originalHeight;
  const slideAspectRatio = slideLayout.width / slideLayout.height;
  const maxWidth = slideLayout.width * slideLayout.imageScale;
  const maxHeight = slideLayout.height * slideLayout.imageScale;

  let finalWidth: number;
  let finalHeight: number;

  if (aspectRatio > slideAspectRatio) {
    finalWidth = maxWidth;
    finalHeight = maxWidth / aspectRatio;
  } else {
    finalHeight = maxHeight;
    finalWidth = maxHeight * aspectRatio;
  }

  return {
    width: finalWidth,
    height: finalHeight,
    x: (slideLayout.width - finalWidth) / 2,
    y: (slideLayout.height - finalHeight) / 2,
  };
};

// Validate the base64 image data format
const isValidBase64Image = (base64Data: string): boolean => {
  if (!base64Data) {
    throw new Error('Image data is empty or undefined');
  }

  if (base64Data.startsWith('data:image/')) {
    return true;
  }

  try {
    atob(base64Data);
    return true;
  } catch {
    throw new Error('Invalid base64 image data provided');
  }
};

// Ensure that the base64 image data has the correct format
const ensureDataImageFormat = (base64Data: string): string => {
  return base64Data.startsWith('data:image/') ? base64Data : `data:image/png;base64,${base64Data}`;
};

// Calculate the image layout based on the image data and the slide layout
const calculateImageLayoutFromData = (
  base64Data: string,
  slideLayout: Config['layout']
): Promise<ImageDimensions> => {
  return new Promise((resolve, reject) => {
    const imageElement = new Image();

    imageElement.onload = () => {
      try {
        const layout = calculateOptimalImageLayout(
          imageElement.width,
          imageElement.height,
          slideLayout
        );
        resolve(layout);
      } catch (error) {
        reject(new Error('Failed to calculate image layout'));
      }
    };

    imageElement.onerror = () => {
      reject(new Error('Failed to load image from provided data'));
    };

    imageElement.src = ensureDataImageFormat(base64Data);
  });
};

// Create the image configuration object for the slide
const createSlideImageConfig = (base64Data: string, layout: ImageDimensions) => ({
  data: ensureDataImageFormat(base64Data),
  x: layout.x,
  y: layout.y,
  w: layout.width,
  h: layout.height,
  sizing: {
    type: 'contain' as const,
    w: layout.width,
    h: layout.height,
  },
});

export class ImageManager {
  constructor(
    private readonly presentation: pptxgen,
    private readonly config: Config
  ) {}

  public async createCaptureSlide(base64Data: string): Promise<void> {
    logger.debug('Creating capture slide');

    try {
      if (!isValidBase64Image(base64Data)) {
        throw new Error('Image validation failed: Invalid format');
      }

      const imageLayout = await calculateImageLayoutFromData(base64Data, this.config.layout);
      logger.debug('Image layout calculated', { layout: imageLayout });

      const slide = this.presentation.addSlide();
      const imageConfig = createSlideImageConfig(base64Data, imageLayout);

      slide.addImage(imageConfig);

      logger.debug('Capture slide created', { layout: imageLayout });
    } catch (error) {
      logger.error('Failed to create capture slide:', error);
      throw new Error('Failed to create capture slide');
    }
  }
}
