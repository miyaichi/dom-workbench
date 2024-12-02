import { PDFDocument } from 'pdf-lib';
import { Logger } from '../logger';

const logger = new Logger('pdfDocumentManager');

export class PDFDocumentManager {
  private pdfDoc: PDFDocument | null = null;
  private manifest: chrome.runtime.Manifest;

  constructor() {
    this.manifest = chrome.runtime.getManifest();
    logger.debug('PDFDocumentManager instance created with manifest', {
      name: this.manifest.name,
      version: this.manifest.version,
    });
  }

  async initialize(): Promise<void> {
    try {
      logger.debug('Initializing PDF document');
      this.pdfDoc = await PDFDocument.create();
      this.pdfDoc.setAuthor(`${this.manifest.name} v${this.manifest.version}`);
      logger.debug('PDF document initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize PDF document:', error);
      throw new Error('PDF document initialization failed');
    }
  }

  setTitle(title: string): void {
    if (!this.pdfDoc) {
      throw new Error('PDF document not initialized');
    }
    this.pdfDoc.setTitle(title);
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

  getPDFDocument(): PDFDocument {
    if (!this.pdfDoc) {
      throw new Error('PDF document not initialized');
    }
    return this.pdfDoc;
  }

  getManifest(): chrome.runtime.Manifest {
    return this.manifest;
  }
}
