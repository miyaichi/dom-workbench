import { Logger } from '../logger';
import { DEFAULTS } from './config';

export async function generatePPTX(pptxData: string): Promise<Blob> {
  const logger = new Logger('pptxGenerator');
  logger.debug('Generating PPTX blob from base64 data');

  try {
    const byteCharacters = atob(pptxData);
    const byteArray = new Uint8Array(byteCharacters.split('').map((char) => char.charCodeAt(0)));
    const blob = new Blob([byteArray], { type: DEFAULTS.MIME_TYPE });

    logger.debug('PPTX blob generated successfully');
    return blob;
  } catch (error) {
    logger.error('Failed to generate PPTX blob:', error);
    throw error;
  }
}
