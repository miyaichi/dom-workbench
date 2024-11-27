// src/utils/contextHelpers.ts
import { Context } from '../types/messages';

/**
 * Get the context for a content script based on the tab ID.
 * @param tabId
 * @returns context
 */
export const getContentScriptContext = (tabId: number): Context => {
  return `content-${tabId}` as Context;
};

/**
 * Check if the context is for a content script.
 * @param context
 * @returns boolean
 */
export const isContentScriptContext = (context: Context): boolean => {
  return context.startsWith('content-');
};

/**
 * Get the tab ID from the context.
 * @param context
 * @returns tabId
 */
export const getTabIdFromContext = (context: Context): number | undefined => {
  if (!isContentScriptContext(context)) {
    return undefined;
  }
  const tabId = parseInt(context.replace('content-', ''), 10);
  return isNaN(tabId) ? undefined : tabId;
};
