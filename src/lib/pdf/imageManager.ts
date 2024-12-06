import { PDFDocument, PDFPage } from 'pdf-lib';
import { Logger } from '../logger';
import { ImageDimensions, PageConfig } from './types';

const logger = new Logger('pdfImageManager');

export class ImageManager {
  constructor(private readonly config: PageConfig) {}

  /**
   * Process image data and create embedded image
   * @param pdfDoc PDF document instance
   * @param imageData Base64 encoded image data
   * @returns Object containing the embedded image and its calculated dimensions
   */
  async processImage(
    pdfDoc: PDFDocument,
    imageData: string
  ): Promise<{
    image: any;
    dimensions: ImageDimensions;
  }> {
    try {
      logger.debug('Processing image data for PDF');

      // Convert base64 to byte array
      const base64Data = imageData.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid image data format');
      }

      const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

      // Embed image in PDF
      const image = await pdfDoc.embedPng(imageBytes);
      logger.debug('Image embedded in PDF successfully');

      // Calculate dimensions and return
      return this.calculateDimensions(image);
    } catch (error) {
      logger.error('Failed to process image:', error);
      throw new Error('Image processing failed');
    }
  }

  /**
   * Create a new PDF page with the image
   * @param pdfDoc PDF document instance
   * @param image Embedded PDF image
   * @param dimensions Calculated image dimensions
   * @returns Created PDF page
   */
  createPage(pdfDoc: PDFDocument, image: any, dimensions: ImageDimensions): PDFPage {
    try {
      logger.debug('Creating image page');

      // Create new page
      const page = pdfDoc.addPage([this.config.WIDTH, this.config.HEIGHT]);

      // Draw image on page
      page.drawImage(image, {
        x: dimensions.x,
        y: dimensions.y,
        width: dimensions.width,
        height: dimensions.height,
      });

      logger.debug('Image page created successfully');
      return page;
    } catch (error) {
      logger.error('Failed to create image page:', error);
      throw new Error('Page creation failed');
    }
  }

  /**
   * Calculate image dimensions based on page constraints
   * @param image Embedded PDF image
   * @returns Object containing the image and its calculated dimensions
   */
  private calculateDimensions(image: any): {
    image: any;
    dimensions: ImageDimensions;
  } {
    try {
      logger.debug('Calculating image dimensions');

      // Get original image dimensions at scale 1
      const imageDims = image.scale(1);

      // Calculate available space
      const availableWidth = this.config.WIDTH - this.config.MARGIN * 2;
      const availableHeight = this.config.HEIGHT - this.config.MARGIN * 2;

      // Calculate scale factors
      const widthScale = availableWidth / imageDims.width;
      const heightScale = availableHeight / imageDims.height;

      // Use the smaller scale factor to maintain aspect ratio
      const scale = Math.min(widthScale, heightScale) * this.config.IMAGE_SCALE;

      // Calculate final dimensions
      const scaledWidth = imageDims.width * scale;
      const scaledHeight = imageDims.height * scale;

      // Calculate position to center the image
      const dimensions: ImageDimensions = {
        width: scaledWidth,
        height: scaledHeight,
        x: (this.config.WIDTH - scaledWidth) / 2,
        y: (this.config.HEIGHT - scaledHeight) / 2,
      };

      logger.debug('Image dimensions calculated', {
        originalSize: {
          width: imageDims.width,
          height: imageDims.height,
        },
        scaledSize: {
          width: dimensions.width,
          height: dimensions.height,
        },
        position: {
          x: dimensions.x,
          y: dimensions.y,
        },
      });

      return { image, dimensions };
    } catch (error) {
      logger.error('Failed to calculate dimensions:', error);
      throw new Error('Dimension calculation failed');
    }
  }

  /**
   * Validate image dimensions are within acceptable bounds
   * @param dimensions Image dimensions to validate
   * @returns boolean indicating if dimensions are valid
   */
  private validateDimensions(dimensions: ImageDimensions): boolean {
    const minSize = 10; // Minimum size in points
    const isValidSize =
      dimensions.width >= minSize &&
      dimensions.height >= minSize &&
      dimensions.width <= this.config.WIDTH &&
      dimensions.height <= this.config.HEIGHT;

    const isValidPosition =
      dimensions.x >= 0 &&
      dimensions.y >= 0 &&
      dimensions.x + dimensions.width <= this.config.WIDTH &&
      dimensions.y + dimensions.height <= this.config.HEIGHT;

    return isValidSize && isValidPosition;
  }

  /**
   * Get the current page configuration
   * @returns Current page configuration
   */
  getConfig(): PageConfig {
    return { ...this.config };
  }
}
