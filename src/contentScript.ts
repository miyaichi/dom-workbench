import { ConnectionManager } from './lib/connectionManager';
import { Logger } from './lib/logger';
import { ElementInfo } from './types/domSelection';
import { Context } from './types/messages';
import { getContentScriptContext } from './utils/contextHelpers';
import { createElementInfo, getElementByPath } from './utils/domSelection';
import { htmlToDoc } from './utils/htmlToDoc';

const logger = new Logger('contentScript');

class ContentScript {
  private static instance: ContentScript | null = null;
  private manager: ConnectionManager;
  private context: Context;
  private state = {
    isSelectionMode: false,
    selectedElementInfo: null as ElementInfo | null,
    hoveredElement: null as HTMLElement | null,
  };

  constructor(sender: chrome.runtime.MessageSender) {
    if (!sender.tab?.id) {
      throw new Error('Tab ID not available');
    }
    this.context = getContentScriptContext(sender.tab.id);
    this.manager = ConnectionManager.getInstance();
    this.initialize();
  }

  public static getInstance(sender: chrome.runtime.MessageSender): ContentScript {
    if (!ContentScript.instance) {
      ContentScript.instance = new ContentScript(sender);
    }
    return ContentScript.instance;
  }

  private async initialize() {
    logger.log('Initializing ...');
    try {
      this.manager.setContext(this.context);
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
    this.manager.subscribe('GET_CONTENT_STATE', async () => {
      logger.debug('Received GET_CONTENT_STATE request');
      await this.sendCurrentState();
    });
    this.manager.subscribe('TOGGLE_SELECTION_MODE', (message) => {
      this.toggleSelectionMode(message.payload.enabled);
    });
    this.manager.subscribe('SELECT_ELEMENT', (message) => {
      const element = getElementByPath(message.payload.path);
      if (element) {
        this.handleElementSelection(element as HTMLElement);
      }
    });
    this.manager.subscribe('INJECT_TAG', (message) => {
      this.handleTagInjection(message.payload.tag, message.payload.tagId);
    });
    this.manager.subscribe('REMOVE_TAG', (message) => {
      this.handleTagRemoval(message.payload.tagId);
    });
    this.manager.subscribe('UPDATE_ELEMENT_STYLE', (message) => {
      this.handleElementStyleUpdate(message.payload.property, message.payload.value);
    });
  }

  private handleMouseOver(event: MouseEvent) {
    if (!this.state.isSelectionMode) return;

    const target = event.target as HTMLElement;
    if (!target || target === document.body || target === document.documentElement) return;

    if (this.state.hoveredElement && this.state.hoveredElement !== target) {
      this.state.hoveredElement.classList.remove('extension-highlight');
    }

    this.state.hoveredElement = target;
    target.classList.add('extension-highlight');
  }

  private handleMouseOut(event: MouseEvent) {
    if (!this.state.isSelectionMode || !this.state.hoveredElement) return;

    const target = event.target as HTMLElement;
    if (target === this.state.hoveredElement) {
      target.classList.remove('extension-highlight');
      this.state.hoveredElement = null;
    }
  }

  private handleClick(event: MouseEvent) {
    if (!this.state.isSelectionMode) return;

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

    // Clear hover, set selected element, set selected
    element.classList.remove('extension-highlight');
    this.state.selectedElementInfo = createElementInfo(element);
    element.classList.add('extension-selected');

    logger.debug('Element selected:', this.state.selectedElementInfo);
    this.manager.sendMessage(
      'ELEMENT_SELECTED',
      { elementInfo: this.state.selectedElementInfo },
      'sidepanel'
    );
  }

  private async sendCurrentState() {
    logger.log(`Sending current state ${this.state} from ${this.context}`);
    await this.manager.sendMessage(
      'CONTENT_STATE_UPDATE',
      {
        isSelectionMode: this.state.isSelectionMode,
        selectedElementInfo: this.state.selectedElementInfo,
      },
      'sidepanel'
    );
  }

  private toggleSelectionMode(enabled: boolean) {
    if (this.state.isSelectionMode === enabled) return;

    this.state.isSelectionMode = enabled;

    if (!enabled) {
      this.clearSelection();
    }

    document.documentElement.classList.toggle('extension-selection-mode', enabled);
    document.body.classList.toggle('extension-selection-mode', enabled);

    logger.debug('Selection mode toggled:', {
      enabled: this.state.isSelectionMode,
      hasSelectionModeClass: document.documentElement.classList.contains(
        'extension-selection-mode'
      ),
    });
  }

  private clearSelection() {
    // Clear hovered element
    if (this.state.hoveredElement) {
      this.state.hoveredElement.classList.remove('extension-highlight');
      this.state.hoveredElement = null;
    }

    // Clear selected elements
    const selectedElements = document.querySelectorAll('.extension-selected');
    selectedElements.forEach((element) => {
      element.classList.remove('extension-selected');
    });

    // Clear selected element info
    if (this.state.selectedElementInfo) {
      logger.debug('Element unselected:', this.state.selectedElementInfo);
      this.manager.sendMessage('ELEMENT_UNSELECTED', {
        elementInfo: this.state.selectedElementInfo,
      });
      this.state.selectedElementInfo = null;
    }
  }

  private handleElementStyleUpdate(property: string, value: string) {
    if (!this.state.selectedElementInfo) {
      logger.error('No element selected for style update');
      return;
    }

    try {
      const targetElement = getElementByPath(this.state.selectedElementInfo.path);
      if (!targetElement) {
        throw new Error('Target element not found');
      }

      const STYLE_MODIFIED_ATTRIBUTE = 'data-extension-modified-styles';

      let modifiedStyles: { [key: string]: string } = {};
      const existingStyles = targetElement.getAttribute(STYLE_MODIFIED_ATTRIBUTE);
      if (existingStyles) {
        modifiedStyles = JSON.parse(existingStyles);
      }

      // Update element style
      targetElement.style[property as any] = value;

      // Update modified styles
      modifiedStyles[property] = value;
      targetElement.setAttribute(STYLE_MODIFIED_ATTRIBUTE, JSON.stringify(modifiedStyles));

      logger.log('Element style updated:', {
        property,
        value,
        path: this.state.selectedElementInfo.path,
      });

      this.manager.sendMessage(
        'SHOW_TOAST',
        {
          message: chrome.i18n.getMessage('toastStyleUpdated'),
          type: 'success',
        },
        'sidepanel'
      );
    } catch (error) {
      logger.error('Element style update failed:', error);
      this.manager.sendMessage(
        'SHOW_TOAST',
        {
          message: chrome.i18n.getMessage('toastStyleUpdateFailed'),
          type: 'error',
        },
        'sidepanel'
      );
    }
  }

  private async handleTagInjection(tag: string, tagId: string) {
    if (!this.state.selectedElementInfo) {
      return;
    }

    try {
      const targetElement = getElementByPath(this.state.selectedElementInfo.path);
      if (!targetElement) {
        throw new Error('Target element not found');
      }

      const TAG_ID_ATTRIBUTE = 'data-injected-tag-id';

      const domElement = await htmlToDoc(tag, {
        async: true,
        preserveOrder: true,
        onScriptsLoaded: () => {
          logger.debug(`Scripts loaded for tag ${tagId}`);
          this.manager.sendMessage(
            'SHOW_TOAST',
            {
              message: chrome.i18n.getMessage('toastTagLoaded'),
              type: 'success',
              duration: 2000,
            },
            'sidepanel'
          );
        },
      });

      // Set tag ID to the root element of the injected tag
      if (domElement instanceof DocumentFragment) {
        Array.from(domElement.children).forEach((child) => {
          child.setAttribute(TAG_ID_ATTRIBUTE, tagId);
        });
      } else if (domElement instanceof Element) {
        domElement.setAttribute(TAG_ID_ATTRIBUTE, tagId);
      }

      targetElement.appendChild(domElement);

      logger.log('Tag injected successfully:', {
        tagId,
        targetPath: this.state.selectedElementInfo.path,
      });

      this.manager.sendMessage(
        'SHOW_TOAST',
        { message: chrome.i18n.getMessage('toastTagInjected'), type: 'success' },
        'sidepanel'
      );
    } catch (error) {
      logger.error('Tag injection failed:', error);
      this.manager.sendMessage(
        'SHOW_TOAST',
        { message: chrome.i18n.getMessage('toastTagInjected'), type: 'error' },
        'sidepanel'
      );
    }
  }

  private handleTagRemoval(tagId: string) {
    try {
      const TAG_ID_ATTRIBUTE = 'data-injected-tag-id';
      const injectedElements = document.querySelectorAll(`[${TAG_ID_ATTRIBUTE}="${tagId}"]`);

      if (injectedElements.length === 0) {
        throw new Error(`No elements found with tag ID: ${tagId}`);
      }

      injectedElements.forEach((element) => {
        element.remove();
      });

      logger.log('Tag removed successfully:', { tagId });

      this.manager.sendMessage(
        'SHOW_TOAST',
        { message: chrome.i18n.getMessage('toastTagRemoved'), type: 'success' },
        'sidepanel'
      );
    } catch (error) {
      logger.error('Tag removal failed:', error);
      this.manager.sendMessage(
        'SHOW_TOAST',
        {
          message: chrome.i18n.getMessage('toastTagRemoveFailed'),
          type: 'error',
        },
        'sidepanel'
      );
    }
  }
}

// ContentScript initialization
const contentScriptInstances = new WeakMap<Window, ContentScript>();

// Ensure content script is initialized immediately
if (!contentScriptInstances.has(window)) {
  logger.log('Initializing content script...');
  // Get the tab ID from the background
  chrome.runtime.sendMessage({ type: 'GET_TAB_ID' }, (response) => {
    if (chrome.runtime.lastError) {
      logger.error('Failed to get tab ID:', chrome.runtime.lastError);
      return;
    }

    const sender = {
      tab: { id: response.tabId },
    } as chrome.runtime.MessageSender;

    contentScriptInstances.set(window, new ContentScript(sender));
  });
}
