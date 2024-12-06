import { PDFDocument, PageSizes } from 'pdf-lib';
import { Logger } from '../logger';
import { PaperSettings } from '../settings';

const logger = new Logger('pdfDocumentManager');

const PAGE_DIMENSIONS = {
  a4: PageSizes.A4,
  '16x9': [960, 540] as [number, number],
} as const;

export class DocumentManager {
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

  addPage(paperSettings: PaperSettings) {
    if (!this.pdfDoc) {
      throw new Error('PDF document not initialized');
    }

    try {
      const baseSize = PAGE_DIMENSIONS[paperSettings.size];

      const [width, height] =
        paperSettings.orientation === 'landscape' ? [baseSize[1], baseSize[0]] : baseSize;

      logger.debug('Adding page with size:', {
        size: paperSettings.size,
        orientation: paperSettings.orientation,
        dimensions: `${width}x${height}`,
      });

      return this.pdfDoc.addPage([width, height]);
    } catch (error) {
      logger.error('Failed to add page:', error);
      throw new Error('Failed to add page with specified size');
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
