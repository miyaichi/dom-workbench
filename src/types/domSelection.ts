/** Information about a DOM element in the tree structure */
export interface ElementInfo {
  /** HTML start tag of the element */
  startTag: string;
  /** HTML element's computed style */
  computedStyle: CSSStyleDeclaration;
  /** Array of indices representing the path from root to this element */
  path: number[];
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

/** Constants for DOM selection related events */
export const DOM_SELECTION_EVENTS = {
  /** Event for selecting an element */
  SELECT_ELEMENT: 'SELECT_ELEMENT',
  /** Event for when an element is selected */
  ELEMENT_SELECTED: 'ELEMENT_SELECTED',
  /** Event for when an element is unselected */
  ELEMENT_UNSELECTED: 'ELEMENT_UNSELECTED',
  /** Event for clearing the selection */
  CLEAR_SELECTION: 'CLEAR_SELECTION',
  /** Event for updating an element's style */
  UPDATE_ELEMENT_STYLE: 'UPDATE_ELEMENT_STYLE',
  /** Event for toggling selection mode */
  TOGGLE_SELECTION_MODE: 'TOGGLE_SELECTION_MODE',
} as const;

/** Constants for UI related events */
export const UI_EVENTS = {
  /** Event for when the side panel is closed */
  SIDE_PANEL_CLOSED: 'SIDE_PANEL_CLOSED',
  /** Event for capturing a tab */
  CAPTURE_TAB: 'CAPTURE_TAB',
  /** Event for the result of capturing a tab */
  CAPTURE_TAB_RESULT: 'CAPTURE_TAB_RESULT',
} as const;

/** Constants for browser state change events */
export const BROWSER_EVENTS = {
  /** Event for when a tab is activated */
  TAB_ACTIVATED: 'TAB_ACTIVATED',
  /** Event for when a tab is updated */
  TAB_UPDATED: 'TAB_UPDATED',
} as const;

/** Type representing a DOM selection event */
export type DOMSelectionEvent = (typeof DOM_SELECTION_EVENTS)[keyof typeof DOM_SELECTION_EVENTS];

/** Type representing a UI event */
export type UIEvent = (typeof UI_EVENTS)[keyof typeof UI_EVENTS];

/** Interface for a message with a generic payload */
export interface Message<T = unknown> {
  /** Type of the event */
  type: DOMSelectionEvent;
  /** Payload of the message */
  payload: T;
}

/** Interface for a style modification */
export interface StyleModification {
  /** CSS property to be modified */
  property: string;
  value: string;
}
