import pptxgen from 'pptxgenjs';
import { formatTimestamp } from '../../utils/formatters';
import { Logger } from '../logger';
import { Config } from './types';

const logger = new Logger('pptDocumentManager');
const MIME_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export class DocumentManager {
  private pres: pptxgen | null = null;
  private manifest: chrome.runtime.Manifest;

  constructor(
    private readonly config: Config,
    private readonly url: string
  ) {
    this.manifest = chrome.runtime.getManifest();
    this.initialize();
  }

  private initialize(): void {
    logger.debug('Initializing presentation');

    this.pres = new pptxgen();

    this.pres.author = `${this.manifest.name} v${this.manifest.version}`;
    this.pres.title = `Capture of ${this.url} at ${formatTimestamp(new Date())}`;

    const { size, orientation } = this.config.paper;
    const { width, height } = this.config.layout;

    if (size === 'a4') {
      const layoutName = orientation === 'landscape' ? 'A4_L' : 'A4';
      this.pres.defineLayout({ name: layoutName, width, height });
      this.pres.layout = layoutName;
    } else {
      const layoutName = orientation === 'portrait' ? 'LAYOUT_9x16' : 'LAYOUT_16x9';
      if (orientation === 'portrait') {
        this.pres.defineLayout({ name: layoutName, width, height });
      }
      this.pres.layout = layoutName;
    }
  }

  public getPPTDocument(): pptxgen {
    if (!this.pres) {
      throw new Error('Presentation not initialized');
    }
    return this.pres;
  }

  public async save(): Promise<Blob> {
    logger.debug('Generating PPTX blob from base64 data');

    if (!this.pres) {
      throw new Error('Presentation not initialized');
    }

    const pptxOutput = await this.pres.write({ outputType: 'base64' });
    if (typeof pptxOutput !== 'string') {
      throw new Error(
        'PowerPoint generation failed: Expected base64 string output but received different type'
      );
    }

    try {
      const byteCharacters = atob(pptxOutput);
      const byteArray = new Uint8Array(byteCharacters.split('').map((char) => char.charCodeAt(0)));
      const blob = new Blob([byteArray], { type: MIME_TYPE });

      return blob;
    } catch (error) {
      logger.error('Failed to generate PPTX blob:', error);
      throw error;
    }
  }
}
