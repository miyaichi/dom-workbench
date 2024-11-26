import { Properties as CSSStyleDeclaration } from 'csstype';
import { ElementInfo } from './domSelection';

export type Context = 'content' | 'background' | 'sidepanel';

export interface Messages {
  TAB_ACTIVATED: void;
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
