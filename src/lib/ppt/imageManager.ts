import pptxgen from 'pptxgenjs';
import { Logger } from '../logger';
import { ImageDimensions, SlideConfig } from './types';

const logger = new Logger('pptImageManager');

export class PPTImageManager {
  private readonly slideConfig: SlideConfig;

  constructor(
    private readonly pres: pptxgen,
    slideConfig: SlideConfig
  ) {
    this.slideConfig = slideConfig;
  }

  private calculateImageDimensions(img: HTMLImageElement): ImageDimensions {
    logger.debug('Calculating image dimensions', {
      originalSize: { width: img.width, height: img.height },
    });

    const imgRatio = img.width / img.height;
    const slideRatio = this.slideConfig.WIDTH / this.slideConfig.HEIGHT;
    const availableWidth = this.slideConfig.WIDTH * this.slideConfig.IMAGE_SCALE;
    const availableHeight = this.slideConfig.HEIGHT * this.slideConfig.IMAGE_SCALE;

    let width: number;
    let height: number;

    if (imgRatio > slideRatio) {
      width = availableWidth;
      height = width / imgRatio;
    } else {
      height = availableHeight;
      width = height * imgRatio;
    }

    const x = (this.slideConfig.WIDTH - width) / 2;
    const y = (this.slideConfig.HEIGHT - height) / 2;

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
        throw new Error('Image data is empty');
      }

      if (imageData.startsWith('data:image/')) {
        return true;
      }

      atob(imageData);
      return true;
    } catch (error) {
      logger.error('Invalid image data:', error);
      return false;
    }
  }

  public async createScreenshotSlide(imageData: string): Promise<void> {
    logger.debug('Creating screenshot slide');

    try {
      if (!this.validateImageData(imageData)) {
        throw new Error('Invalid image data format');
      }

      const slide = this.pres.addSlide();
      const imageDims = await this.getImageDimensions(imageData);

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
}
