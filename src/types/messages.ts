import { ElementInfo } from './types';

export type StaticContext = 'background' | 'sidepanel' | 'undefined';
export type ContentContext = `content-${string}`;
export type Context = StaticContext | ContentContext;

export interface Messages {
  CAPTURE_TAB: void;
  CAPTURE_TAB_RESULT: {
    success: boolean;
    error?: string;
    imageDataUrl?: string;
    url: string | null;
  };
  CONTENT_STATE_UPDATE: { isSelectionMode: boolean; selectedElementInfo: ElementInfo | null };
  DEBUG: void;
  ELEMENT_SELECTED: { elementInfo: ElementInfo };
  ELEMENT_UNSELECTED: { elementInfo: ElementInfo };
  GET_CONTENT_STATE: void;
  INJECT_TAG: { tag: string; tagId: string };
  REMOVE_TAG: { tagId: string };
  SELECT_ELEMENT: { path: number[] };
  SHOW_TOAST: { message: string; type?: 'success' | 'error'; duration?: number };
  TAB_ACTIVATED: { tabId: number };
  TOGGLE_SELECTION_MODE: { enabled: boolean };
  UPDATE_ELEMENT_STYLE: { property: string; value: string };
}

export type MessageType = keyof Messages;

export interface Message<T = unknown> {
  id: string;
  type: MessageType;
  payload: T;
  source: Context;
  target?: Context;
  timestamp: number;
}
