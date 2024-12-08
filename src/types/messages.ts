import { Context, ElementInfo } from './types';

// Tab information type
export interface TabInfo {
  tabId: number;
  windowId: number;
  url: string;
  isScriptInjectionAllowed: boolean;
}

// Message payloads type
export interface MessagePayloads {
  CAPTURE_TAB: void;
  CAPTURE_TAB_RESULT: {
    success: boolean;
    error?: string;
    imageDataUrl?: string;
    url: string | null;
  };
  CONTENT_STATE_UPDATE: { isSelectionMode: boolean; selectedElementInfo: ElementInfo | null };
  ELEMENT_SELECTED: { elementInfo: ElementInfo };
  ELEMENT_UNSELECTED: { elementInfo: ElementInfo };
  GET_CONTENT_STATE: undefined;
  INJECT_TAG: { tag: string; tagId: string };
  REMOVE_TAG: { tagId: string };
  SELECT_ELEMENT: { path: number[] };
  SELECTION_MODE_TOGGLED: { enabled: boolean };
  SHOW_TOAST: { message: string; type?: 'success' | 'error'; duration?: number };
  TOGGLE_SELECTION_MODE: { enabled: boolean };
  UPDATE_ELEMENT_STYLE: { property: string; value: string };
}

// Base message structure
export interface BaseMessage {
  type: keyof MessagePayloads;
  payload: unknown;
  source: Context;
  target: Context;
  timestamp: number;
}

// Message handler type
export type MessageHandler<T extends BaseMessage = BaseMessage> = (message: T) => void;

// Message type
export type Message<T extends keyof MessagePayloads> = BaseMessage & {
  type: T;
  payload: MessagePayloads[T];
};

// Union of all message types
export type ExtensionMessage = {
  [K in keyof MessagePayloads]: Message<K>;
}[keyof MessagePayloads];
