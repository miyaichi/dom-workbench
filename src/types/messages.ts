import { Properties as CSSStyleDeclaration } from 'csstype';
import { ElementInfo } from './domSelection';

export type StaticContext = 'background' | 'sidepanel' | 'undefined';
export type ContentContext = `content-${string}`;
export type Context = StaticContext | ContentContext;

export interface Messages {
  TAB_ACTIVATED: { tabId: number };
  GET_CONTENT_STATE: void;
  CONTENT_STATE_UPDATE: { isSelectionMode: boolean; selectedElementInfo: ElementInfo | null };
  TOGGLE_SELECTION_MODE: { enabled: boolean };
  ELEMENT_SELECTED: { elementInfo: ElementInfo };
  ELEMENT_UNSELECTED: { elementInfo: ElementInfo };
  SELECT_ELEMENT: { path: number[] };
  UPDATE_ELEMENT_STYLE: { path: number[]; style: CSSStyleDeclaration };
  CAPTURE_TAB: void;
  CAPTURE_TAB_RESULT: {
    success: boolean;
    error?: string;
    imageDataUrl?: string;
    url: string | null;
  };
  INJECT_TAG: { tag: string };
  INJECT_TAG_RESULT: { success: boolean; tagId?: string; error?: string };
  REMOVE_TAG: { tagId: string };
  REMOVE_TAG_RESULT: { success: boolean; tagId: string; error?: string };
  DEBUG: void;
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
