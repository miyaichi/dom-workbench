import { ConnectionManager, Message } from './lib/connectionManager';
import { Logger } from './lib/logger';
import { ElementInfo } from './types/domSelection';
import { createElementInfo, getElementByPath } from './utils/domSelection';

const logger = new Logger('contentScript');

class ContentScript {
  private static instance: ContentScript | null = null;
  private manager: ConnectionManager;
  private isSelectionMode = false;
  private hoveredElement: HTMLElement | null = null;
  private selectedElementInfo: ElementInfo | null = null;

  constructor() {
    this.manager = ConnectionManager.getInstance();
    this.initialize();
  }

  public static getInstance(): ContentScript {
    if (!ContentScript.instance) {
      ContentScript.instance = new ContentScript();
    }
    return ContentScript.instance;
  }

  private async initialize() {
    logger.log('Initializing ...');
    try {
      this.manager.setContext('content');
      this.injectStyles();
      this.setupEventHandlers();
      logger.log('initialization complete');
    } catch (error) {
      logger.error('Initialization failed:', error);
    }
  }

  private injectStyles() {
    const styleId = 'extension-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = this.getInjectedStyles();
      document.head.appendChild(style);
      logger.debug('Styles injected successfully');
    }
  }

  private getInjectedStyles(): string {
    return `
      .extension-selection-mode,
      .extension-selection-mode * {
        cursor: crosshair !important;
        user-select: none !important;
      }
      
      .extension-highlight {
        outline: 2px solid #ffd700 !important;
        outline-offset: 2px;
        background-color: rgba(255, 215, 0, 0.1) !important;
        transition: all 0.2s ease;
        pointer-events: auto !important;
      }

      .extension-selected {
        outline: 2px solid #4682B4 !important;
        outline-offset: 2px;
        background-color: rgba(70, 130, 180, 0.1) !important;
        transition: all 0.2s ease;
      }

      html.extension-selection-mode,
      html.extension-selection-mode body,
      html.extension-selection-mode * {
        cursor: crosshair !important;
      }
    `;
  }

  private setupEventHandlers() {
    // Mouse event listeners
    document.addEventListener('mouseover', this.handleMouseOver.bind(this), true);
    document.addEventListener('mouseout', this.handleMouseOut.bind(this), true);
    document.addEventListener('click', this.handleClick.bind(this), true);

    // Message subscribers
    this.manager.subscribe('TOGGLE_SELECTION_MODE', (message: Message) => {
      this.toggleSelectionMode(message.payload.enabled);
    });

    this.manager.subscribe('SELECT_ELEMENT', (message: Message) => {
      const element = getElementByPath(message.payload.path);
      if (element) {
        this.handleElementSelection(element as HTMLElement);
      }
    });

    this.manager.subscribe('INITIALIZE_CONTENT', () => {
      this.clearSelection();
    });
  }

  private handleMouseOver(event: MouseEvent) {
    if (!this.isSelectionMode) return;

    const target = event.target as HTMLElement;
    if (!target || target === document.body || target === document.documentElement) return;

    if (this.hoveredElement && this.hoveredElement !== target) {
      this.hoveredElement.classList.remove('extension-highlight');
    }

    this.hoveredElement = target;
    target.classList.add('extension-highlight');
  }

  private handleMouseOut(event: MouseEvent) {
    if (!this.isSelectionMode || !this.hoveredElement) return;

    const target = event.target as HTMLElement;
    if (target === this.hoveredElement) {
      target.classList.remove('extension-highlight');
      this.hoveredElement = null;
    }
  }

  private handleClick(event: MouseEvent) {
    if (!this.isSelectionMode) return;

    event.preventDefault();
    event.stopPropagation();

    const target = event.target as HTMLElement;
    if (!target || target === document.body || target === document.documentElement) return;

    this.handleElementSelection(target);
  }

  private handleElementSelection(element: HTMLElement) {
    // Clear previously selected elements
    const selectedElements = document.querySelectorAll('.extension-selected');
    selectedElements.forEach((el) => {
      el.classList.remove('extension-selected');
    });

    this.selectedElementInfo = createElementInfo(element);
    logger.debug('Element selected:', this.selectedElementInfo);

    element.classList.remove('extension-highlight');
    element.classList.add('extension-selected');

    this.manager.sendMessage('ELEMENT_SELECTED', {
      elementInfo: this.selectedElementInfo,
    });
  }

  private toggleSelectionMode(enabled: boolean) {
    if (this.isSelectionMode === enabled) return;

    this.isSelectionMode = enabled;

    if (!enabled) {
      this.clearSelection();
    }

    document.documentElement.classList.toggle('extension-selection-mode', enabled);
    document.body.classList.toggle('extension-selection-mode', enabled);

    logger.debug('Selection mode toggled:', {
      enabled: this.isSelectionMode,
      hasSelectionModeClass: document.documentElement.classList.contains(
        'extension-selection-mode'
      ),
    });
  }

  private clearSelection() {
    // Clear hovered element
    if (this.hoveredElement) {
      this.hoveredElement.classList.remove('extension-highlight');
      this.hoveredElement = null;
    }

    // Clear selected elements
    const selectedElements = document.querySelectorAll('.extension-selected');
    selectedElements.forEach((element) => {
      element.classList.remove('extension-selected');
    });

    // Clear selected element info
    if (this.selectedElementInfo) {
      this.manager.sendMessage('ELEMENT_UNSELECTED', {
        elementInfo: this.selectedElementInfo,
      });
      this.selectedElementInfo = null;
    }
  }
}

const contentScriptInstances = new WeakMap<Window, ContentScript>();
if (!contentScriptInstances.has(window)) {
  logger.log('Initializing ...');
  contentScriptInstances.set(window, new ContentScript());
} else {
  logger.log('Already initialized');
}
