import { ConnectionManager, Message, useConnectionManager } from './lib/connectionManager';
import { Logger } from './lib/logger';
import {
  DOM_SELECTION_EVENTS,
  SelectElementPayload,
  SelectionModePayload,
} from './types/domSelection';
import { createElementInfo, getElementByPath } from './utils/domSelection';

// Types
type StyleProperty = 'backgroundColor' | 'outline' | 'border';

interface ElementStyle {
  originalStyles: Partial<Pick<CSSStyleDeclaration, StyleProperty>>;
  element: HTMLElement;
}

interface StyleConfig {
  backgroundColor: string;
  outline: string;
  border: string;
}

// Constants
const HIGHLIGHT_STYLES: StyleConfig = {
  backgroundColor: 'rgba(255, 255, 0, 0.3)',
  outline: '2px solid #ffd700',
  border: '1px solid #ffd700',
};

const STYLE_PROPERTIES: StyleProperty[] = ['backgroundColor', 'outline', 'border'];

// State declarations
const logger = new Logger('ContentScript');
const { sendMessage, subscribe } = useConnectionManager();
const manager = ConnectionManager.getInstance();

let selectionModeEnabled = false;
let lastSelectedElement: HTMLElement | null = null;

const updateCursorStyle = (enabled: boolean): void => {
  document.body.style.cursor = enabled ? 'crosshair' : '';
  logger.debug(`Cursor style updated: ${enabled ? 'crosshair' : 'default'}`);
};

const saveAndHighlightElement = (element: HTMLElement): void => {
  // 前の要素のスタイルを復元
  restoreElementStyle();
  
  // 新しい要素の元のスタイルを保存して、ハイライトを適用
  lastSelectedElement = element;
  
  // ハイライトスタイルを適用
  Object.entries(HIGHLIGHT_STYLES).forEach(([prop, value]) => {
    element.style[prop as StyleProperty] = value;
  });
  
  logger.debug('Element highlighted', { 
    tagName: element.tagName,
    id: element.id,
    classes: element.className
  });
};

const restoreElementStyle = (): void => {
  if (!lastSelectedElement) {
    return;
  }

  // スタイルをデフォルトに戻す
  STYLE_PROPERTIES.forEach((prop) => {
    if (lastSelectedElement) {
      lastSelectedElement.style[prop] = '';
    }
  });

  lastSelectedElement = null;
  logger.debug('Element styles restored');
};

const handleElementSelection = (element: HTMLElement): void => {
  const elementInfo = createElementInfo(element);
  logger.log('Element selected', { 
    tagName: element.tagName,
    id: element.id,
    classes: element.className
  });
  
  saveAndHighlightElement(element);
  sendMessage(DOM_SELECTION_EVENTS.ELEMENT_SELECTED, { elementInfo });
};

const handleElementClick = (event: MouseEvent): void => {
  if (!selectionModeEnabled) return;

  const element = event.target as HTMLElement;
  if (!element || element === document.body) {
    logger.debug('Invalid element clicked or body element');
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  handleElementSelection(element);
};

const cleanup = (): void => {
  logger.log('Performing content script cleanup');
  restoreElementStyle();
  document.removeEventListener('click', handleElementClick, true);
};

const handleSelectionModeToggle = (message: Message<SelectionModePayload>): void => {
  logger.log('Selection mode changed:', message.payload.enabled);
  selectionModeEnabled = message.payload.enabled;
  updateCursorStyle(selectionModeEnabled);

  if (!selectionModeEnabled) {
    restoreElementStyle();
  }
};

const handleSelectElement = (message: Message<SelectElementPayload>): void => {
  const element = getElementByPath(message.payload.path);
  if (!element) {
    logger.error('Failed to find element with path:', message.payload.path);
    return;
  }
  logger.log('Element found by path, processing selection');
  handleElementSelection(element);
};

const handleClearSelection = (): void => {
  logger.log('Clearing element selection');
  restoreElementStyle();
  sendMessage(DOM_SELECTION_EVENTS.ELEMENT_UNSELECTED, { timestamp: Date.now() });
};

const initialize = (): void => {
  logger.log('Initializing content script');
  manager.setContext('content');

  subscribe(DOM_SELECTION_EVENTS.TOGGLE_SELECTION_MODE, handleSelectionModeToggle);
  subscribe<SelectElementPayload>(DOM_SELECTION_EVENTS.SELECT_ELEMENT, handleSelectElement);
  subscribe(DOM_SELECTION_EVENTS.CLEAR_SELECTION, handleClearSelection);

  document.addEventListener('click', handleElementClick, true);
  logger.debug('Event listeners registered');

  chrome.runtime.onConnect.addListener((port) => {
    logger.debug('Port connection established');
    port.onDisconnect.addListener(cleanup);
  });
  
  logger.log('Content script initialization complete');
};

initialize();