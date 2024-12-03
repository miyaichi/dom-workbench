import { html as htmlBeautify } from 'js-beautify';
import { ElementInfo } from '../types/types';

/**
 * Converts ElementInfo structure to formatted HTML string
 * @param elementInfo ElementInfo object containing DOM structure
 * @returns Formatted HTML string
 */
export const elementInfoToHTML = (elementInfo: ElementInfo): string => {
  // Helper function to recursively build HTML string
  const buildHTML = (node: ElementInfo): string => {
    const startTag = node.startTag;

    // If it's a self-closing tag, return it as is
    if (startTag.endsWith('/>')) {
      return startTag;
    }

    // Extract tag name from start tag
    const tagMatch = startTag.match(/<([^ >]+)/);
    if (!tagMatch) {
      throw new Error('Invalid start tag format');
    }
    const tagName = tagMatch[1];

    // Build children HTML
    const childrenHTML = node.children.map((child) => buildHTML(child)).join('');

    // Combine text content and children HTML
    const innerContent = [node.textContent, childrenHTML].filter(Boolean).join('');

    return `${startTag}${innerContent}</${tagName}>`;
  };

  // Build raw HTML string and format it
  const rawHTML = buildHTML(elementInfo);
  return htmlBeautify(rawHTML, {
    indent_size: 2,
    indent_char: ' ',
    max_preserve_newlines: 1,
    preserve_newlines: true,
    wrap_line_length: 0,
    end_with_newline: false,
  });
};
