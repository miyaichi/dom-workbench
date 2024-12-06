import fontBytes from '@assets/fonts/NotoSansJP-Regular.otf';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { Logger } from '../logger';
import { FontConfig } from './types';

const logger = new Logger('pdfFontManager');

export class FontManager {
  static async initialize(pdfDoc: PDFDocument): Promise<FontConfig> {
    logger.debug('Initializing fonts...');
    pdfDoc.registerFontkit(fontkit);

    return {
      japanese: await pdfDoc.embedFont(fontBytes, { subset: false }),
      fallback: await pdfDoc.embedFont(StandardFonts.Helvetica),
    };
  }
}
