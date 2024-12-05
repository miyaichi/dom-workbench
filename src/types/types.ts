/** Information about a DOM element in the tree structure */
export interface ElementInfo {
  /** HTML start tag of the element */
  startTag: string;
  /** HTML element's computed style */
  computedStyle: CSSStyleDeclaration;
  /** Array of indices representing the path from root to this element */
  path: number[];
  /** Text content of the element */
  textContent?: string;
  /** Child nodes in the element tree */
  children: ElementInfo[];
}

/** Payload for element selection events */
export interface SelectElementPayload {
  /** Array of indices representing the path from root to the selected element */
  path: number[];
}

/** Payload for selection mode toggle events */
export interface SelectionModePayload {
  /** Boolean indicating whether selection mode is enabled */
  enabled: boolean;
}

// Context type
export type Context = 'background' | 'sidepanel' | `content-${number}` | 'undefined';

// Connection status type
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
