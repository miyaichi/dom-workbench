import { PDFDocument } from 'pdf-lib';
import { formatTimestamp } from '../../utils/formatters';
import { Logger } from '../logger';
import { Config } from './types';

const logger = new Logger('pdfDocumentManager');

export class DocumentManager {
  private pdfDoc: PDFDocument | null = null;
  private manifest: chrome.runtime.Manifest;

  constructor(
    private readonly config: Config,
    private readonly url: string
  ) {
    this.manifest = chrome.runtime.getManifest();
  }

  async initialize(): Promise<void> {
    logger.debug('Initializing PDF document');
    try {
      this.pdfDoc = await PDFDocument.create();

      this.pdfDoc.setAuthor(`${this.manifest.name} v${this.manifest.version}`);
      this.pdfDoc.setTitle(`Capture of ${this.url} at ${formatTimestamp(new Date())}`);
    } catch (error) {
      logger.error('Failed to initialize PDF document:', error);
      throw new Error('PDF document initialization failed');
    }
  }

  getPDFDocument(): PDFDocument {
    if (!this.pdfDoc) {
      throw new Error('PDF document not initialized');
    }
    return this.pdfDoc;
  }

  async save(): Promise<Uint8Array> {
    if (!this.pdfDoc) {
      throw new Error('PDF document not initialized');
    }
    return await this.pdfDoc.save({
      useObjectStreams: false,
      addDefaultPage: false,
    });
  }
}
