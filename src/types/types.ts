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

/** Context of the message */
export type Context = 'background' | 'sidepanel' | `content-${number}` | 'undefined';

/** Connection status of the connection */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

/** Payload for sharing the current capture */
export interface SharePayload {
  /** Image data URL of the capture */
  imageData: string;
  /** URL of the capture */
  url: string;
  /** Element information of the selected element */
  html: string;
  /** Comment for the capture */
  comment: string;
  /** List of injected tags */
  styleChanges: string;
  /** List of style changes */
  injectedTags: string;
}
