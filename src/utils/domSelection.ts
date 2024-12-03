import { ElementInfo } from '../types/types';

/**
 * Get the DOM path from root to the given element as an array of indices
 * @param element - The HTML element to get the path for
 * @returns An array of indices representing the path from root to the given element
 */
export const getElementPath = (element: HTMLElement): number[] => {
  const path: number[] = [];
  let current = element;

  while (current.parentElement) {
    const parent = current.parentElement;
    const children = Array.from(parent.children);
    const index = children.indexOf(current);
    path.unshift(index);
    current = parent;
  }

  return path;
};

/**
 * Find an element in the DOM using a path of indices
 * @param path - An array of indices representing the path to the element
 * @returns The HTML element found at the given path, or null if not found
 */
export const getElementByPath = (path: number[]): HTMLElement | null => {
  let current: HTMLElement = document.documentElement;

  try {
    for (const index of path) {
      const children = Array.from(current.children) as HTMLElement[];
      if (index >= children.length) return null;
      current = children[index];
    }
  } catch (error) {
    console.error(`[getElementByPath] ${path} is not a valid path`);
    return null;
  }

  return current;
};

/**
 * Get the opening HTML tag of an element
 * @param element - The HTML element to get the start tag for
 * @returns The opening HTML tag of the element as a string
 */
export const getElementStartTag = (element: HTMLElement): string => {
  const clone = element.cloneNode(false) as HTMLElement;
  return clone.outerHTML.split('>')[0] + '>';
};

/**
 * Truncate a string to a maximum length for display
 * @param tag - The string to truncate
 * @param maxLength - The maximum length of the truncated string (default is 20)
 * @returns The truncated string, with "..." appended if it was truncated
 */
export const truncateStartTag = (tag: string, maxLength = 20): string => {
  return tag.length > maxLength ? `${tag.slice(0, maxLength)}...` : tag;
};

/**
 * Get the direct text content of an element, excluding child element content
 * @param element - The HTML element to get text content from
 * @returns The direct text content of the element
 */
export const getDirectTextContent = (element: HTMLElement): string | undefined => {
  return (
    Array.from(element.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent?.trim())
      .filter((text) => text && text.length > 0)
      .join(' ') || undefined
  );
};

/**
 * Build a tree representation of an element and its children
 */
export const buildElementTree = (
  element: HTMLElement,
  currentPath: number[] = []
): ElementInfo[] => {
  const children = Array.from(element.children).flatMap((child, index) => {
    const childPath = [...currentPath, index];
    return buildElementTree(child as HTMLElement, childPath);
  });

  return [
    {
      startTag: getElementStartTag(element),
      computedStyle: getComputedStyle(element),
      path: currentPath,
      textContent: getDirectTextContent(element),
      children,
    },
  ];
};

/**
 * Create an ElementInfo object for a given element
 */
export const createElementInfo = (element: HTMLElement): ElementInfo => {
  const path = getElementPath(element);
  return {
    startTag: getElementStartTag(element),
    computedStyle: getComputedStyle(element),
    path,
    textContent: getDirectTextContent(element),
    children: buildElementTree(element, path),
  };
};
