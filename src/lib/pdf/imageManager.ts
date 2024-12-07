import { PDFDocument, PDFImage, PDFPage } from 'pdf-lib';
import { Logger } from '../logger';
import { Config, ImageDimensions } from './types';

const logger = new Logger('pdfImageManager');

export class ImageManager {
  private readonly MIN_IMAGE_SIZE = 10;

  constructor(private readonly config: Config) {}

  /**
   * Process image data and create embedded image
   */
  async processImage(
    pdfDoc: PDFDocument,
    imageData: string
  ): Promise<{
    image: PDFImage;
    dimensions: ImageDimensions;
  }> {
    try {
      logger.debug('Processing image data for PDF');

      const base64Data = imageData.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid image data format');
      }

      const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const image = await pdfDoc.embedPng(imageBytes);
      logger.debug('Image embedded in PDF successfully');

      const dimensions = this.calculateDimensions(image);
      if (!this.validateDimensions(dimensions)) {
        throw new Error('Image dimensions are invalid');
      }

      return { image, dimensions };
    } catch (error) {
      logger.error('Failed to process image:', error);
      throw error instanceof Error ? error : new Error('Image processing failed');
    }
  }

  /**
   * Create a new PDF page with the embedded image
   */
  createCapturePage(pdfDoc: PDFDocument, image: PDFImage, dimensions: ImageDimensions): PDFPage {
    try {
      logger.debug('Creating capture page');

      if (!this.validateDimensions(dimensions)) {
        throw new Error('Invalid dimensions for page creation');
      }

      const page = pdfDoc.addPage([this.config.page.width, this.config.page.height]);

      page.drawImage(image, {
        x: dimensions.x,
        y: dimensions.y,
        width: dimensions.width,
        height: dimensions.height,
      });

      logger.debug('Capture page created successfully');
      return page;
    } catch (error) {
      logger.error('Failed to create capture page:', error);
      throw error instanceof Error ? error : new Error('Page creation failed');
    }
  }

  /**
   * Calculate image dimensions based on page constraints
   */
  private calculateDimensions(image: PDFImage): ImageDimensions {
    try {
      logger.debug('Calculating image dimensions');

      const imageDims = image.scale(1);
      const availableWidth = this.config.page.width - this.config.page.margin * 2;
      const availableHeight = this.config.page.height - this.config.page.margin * 2;

      const widthScale = availableWidth / imageDims.width;
      const heightScale = availableHeight / imageDims.height;
      const scale = Math.min(widthScale, heightScale) * this.config.page.imageScale;

      const scaledWidth = imageDims.width * scale;
      const scaledHeight = imageDims.height * scale;

      const dimensions: ImageDimensions = {
        width: scaledWidth,
        height: scaledHeight,
        x: (this.config.page.width - scaledWidth) / 2,
        y: (this.config.page.height - scaledHeight) / 2,
      };

      logger.debug('Image dimensions calculated', {
        originalSize: { width: imageDims.width, height: imageDims.height },
        scaledSize: { width: dimensions.width, height: dimensions.height },
        position: { x: dimensions.x, y: dimensions.y },
      });

      return dimensions;
    } catch (error) {
      logger.error('Failed to calculate dimensions:', error);
      throw error instanceof Error ? error : new Error('Dimension calculation failed');
    }
  }

  /**
   * Validate image dimensions are within acceptable bounds
   */
  private validateDimensions(dimensions: ImageDimensions): boolean {
    const isValidSize =
      dimensions.width >= this.MIN_IMAGE_SIZE &&
      dimensions.height >= this.MIN_IMAGE_SIZE &&
      dimensions.width <= this.config.page.width &&
      dimensions.height <= this.config.page.height;

    const isValidPosition =
      dimensions.x >= 0 &&
      dimensions.y >= 0 &&
      dimensions.x + dimensions.width <= this.config.page.width &&
      dimensions.y + dimensions.height <= this.config.page.height;

    return isValidSize && isValidPosition;
  }
}
