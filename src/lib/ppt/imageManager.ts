import pptxgen from 'pptxgenjs';
import { Logger } from '../logger';
import { ImageDimensions, PPTConfig } from './types';

const logger = new Logger('pptImageManager');

export class ImageManager {
  private readonly config: PPTConfig;

  constructor(
    private readonly pres: pptxgen,
    config: PPTConfig
  ) {
    this.config = config;
  }

  private calculateImageDimensions(img: HTMLImageElement): ImageDimensions {
    logger.debug('Calculating image dimensions', {
      originalSize: { width: img.width, height: img.height },
    });

    const imgRatio = img.width / img.height;
    const slideRatio = this.config.layout.width / this.config.layout.height;
    const availableWidth = this.config.layout.width * this.config.layout.imageScale;
    const availableHeight = this.config.layout.height * this.config.layout.imageScale;

    let width: number;
    let height: number;

    if (imgRatio > slideRatio) {
      width = availableWidth;
      height = width / imgRatio;
    } else {
      height = availableHeight;
      width = height * imgRatio;
    }

    const x = (this.config.layout.width - width) / 2;
    const y = (this.config.layout.height - height) / 2;

    const dimensions = { width, height, x, y };

    logger.debug('Image dimensions calculated', {
      scaledSize: { width, height },
      position: { x, y },
    });

    return dimensions;
  }

  private async getImageDimensions(base64ImageData: string): Promise<ImageDimensions> {
    logger.debug('Starting image dimension calculation');

    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        try {
          const dimensions = this.calculateImageDimensions(img);
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

      const imageSource = base64ImageData.startsWith('data:image/')
        ? base64ImageData
        : `data:image/png;base64,${base64ImageData}`;

      img.src = imageSource;
    });
  }

  private validateImageData(imageData: string): boolean {
    try {
      if (!imageData) {
        throw new Error('Image data is empty or undefined');
      }

      if (imageData.startsWith('data:image/')) {
        return true;
      }

      atob(imageData);
      return true;
    } catch (error) {
      throw new Error('Invalid base64 image data provided');
      return false;
    }
  }

  public async createScreenshotSlide(imageData: string): Promise<void> {
    logger.debug('Creating screenshot slide');

    try {
      if (!this.validateImageData(imageData)) {
        throw new Error('Image validation failed: Invalid format');
      }

      const slide = this.pres.addSlide();
      const imageDims = await this.getImageDimensions(imageData);
      logger.debug('Image dimensions calculated', { dimensions: imageDims });

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

      logger.debug('Screenshot slide created', { dimensions: imageDims });
    } catch (error) {
      logger.error('Failed to create screenshot slide:', error);
      throw new Error('Failed to create screenshot slide');
    }
  }
}
