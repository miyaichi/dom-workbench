import { PDFDocument, PDFImage } from 'pdf-lib';
import { Logger } from '../logger';
import { Config, ImageDimensions } from './types';

const logger = new Logger('pdfImageManager');

const MIN_IMAGE_DIMENSION_PIXELS = 10;

// Convert Base64 data to a Uint8Array
const convertBase64ToBytes = (base64Data: string): Uint8Array => {
  return Uint8Array.from(atob(base64Data), (char) => char.charCodeAt(0));
};

// Calculate the optimal image layout based on the page layout and the image aspect ratio
const calculateOptimalImageLayout = (
  pdfImage: PDFImage,
  pageConfig: Config['page']
): ImageDimensions => {
  const originalDimensions = pdfImage.scale(1);
  const contentWidth = pageConfig.width - pageConfig.margin * 2;
  const contentHeight = pageConfig.height - pageConfig.margin * 2;

  const widthScaleFactor = contentWidth / originalDimensions.width;
  const heightScaleFactor = contentHeight / originalDimensions.height;
  const optimalScale = Math.min(widthScaleFactor, heightScaleFactor) * pageConfig.imageScale;

  const finalWidth = originalDimensions.width * optimalScale;
  const finalHeight = originalDimensions.height * optimalScale;

  return {
    width: finalWidth,
    height: finalHeight,
    x: (pageConfig.width - finalWidth) / 2,
    y: (pageConfig.height - finalHeight) / 2,
  };
};

// Validate the image layout to ensure it fits within the page bounds
const isValidImageLayout = (
  layout: ImageDimensions,
  pageWidth: number,
  pageHeight: number,
  minSize: number
): boolean => {
  const hasSufficientSize =
    layout.width >= minSize &&
    layout.height >= minSize &&
    layout.width <= pageWidth &&
    layout.height <= pageHeight;

  const isWithinPageBounds =
    layout.x >= 0 &&
    layout.y >= 0 &&
    layout.x + layout.width <= pageWidth &&
    layout.y + layout.height <= pageHeight;

  return hasSufficientSize && isWithinPageBounds;
};

// Validate the base64 image data format
const isValidBase64Image = (base64Data: string): boolean => {
  if (!base64Data) {
    throw new Error('Image data is empty or undefined');
  }

  const encodedData = base64Data.split(',')[1];
  return !!encodedData;
};

export class ImageManager {
  constructor(
    private readonly pdfDocument: PDFDocument,
    private readonly config: Config
  ) {}

  public async createCapturePage(base64Data: string): Promise<void> {
    logger.debug('Creating capture page');

    try {
      if (!isValidBase64Image(base64Data)) {
        throw new Error('Image validation failed: Invalid format');
      }

      const encodedData = base64Data.split(',')[1];
      const imageBytes = convertBase64ToBytes(encodedData);
      const embeddedImage = await this.pdfDocument.embedPng(imageBytes);

      const imageLayout = calculateOptimalImageLayout(embeddedImage, this.config.page);

      if (
        !isValidImageLayout(
          imageLayout,
          this.config.page.width,
          this.config.page.height,
          MIN_IMAGE_DIMENSION_PIXELS
        )
      ) {
        throw new Error('Invalid layout dimensions for page creation');
      }

      const newPage = this.pdfDocument.addPage([this.config.page.width, this.config.page.height]);

      newPage.drawImage(embeddedImage, {
        x: imageLayout.x,
        y: imageLayout.y,
        width: imageLayout.width,
        height: imageLayout.height,
      });

      logger.debug('Capture page created', { layout: imageLayout });
    } catch (error) {
      logger.error('Failed to create capture page:', error);
      throw error instanceof Error ? error : new Error('Page creation failed');
    }
  }
}
