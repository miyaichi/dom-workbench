// src/components/utils/htmlTagFormatter.ts
import React from 'react';

// Syntax highlighting styles
const defaultStyles = `
.syntax-tag {
  color: #2563eb;
}

.syntax-attr {
  color: #059669;
}

.syntax-value {
  color: #db2777;
  display: inline-block;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.syntax-punctuation {
  color: #4b5563;
}
`;

// Inject the default styles into the document head
const injectStyles = () => {
  if (typeof window === 'undefined') return;

  const styleId = 'html-tag-formatter-styles';
  if (document.getElementById(styleId)) return;

  const styleElement = document.createElement('style');
  styleElement.id = styleId;
  styleElement.textContent = defaultStyles;
  document.head.appendChild(styleElement);
};

/**
 * Configuration options for HTML tag formatting
 */
export interface HTMLTagFormatterOptions {
  /** Whether to display the full content of attribute values without truncation */
  showFullContent?: boolean;
  /** Maximum length for truncated attribute values */
  maxLength?: number;
  /** Custom class names for syntax highlighting elements */
  classNames?: {
    /** Class name for HTML tag names */
    tag?: string;
    /** Class name for attribute names */
    attr?: string;
    /** Class name for attribute values */
    value?: string;
    /** Class name for punctuation characters */
    punctuation?: string;
  };
}

const DEFAULT_CLASSES = {
  tag: 'syntax-tag',
  attr: 'syntax-attr',
  value: 'syntax-value',
  punctuation: 'syntax-punctuation',
} as const;

/**
 * Truncate an attribute value to a maximum length
 * @param value - The attribute value to truncate
 * @param maxLength - The maximum length of the truncated value (default is 25)
 * @returns The truncated attribute value, with "..." appended if it was truncated
 */
export const truncateAttributeValue = (value: string, maxLength: number = 25): string => {
  if (value.length <= maxLength) return value;
  return `${value.substring(0, maxLength)}...`;
};

/**
 * Format an HTML start tag into a React node with syntax highlighting
 * @param startTag - The HTML start tag to format
 * @param options - Optional settings for formatting
 * @param options.showFullContent - Whether to show the full content of attribute values (default is false)
 * @param options.maxLength - The maximum length of truncated attribute values (default is 25)
 * @param options.classNames - Custom class names for syntax highlighting
 * @returns A React node representing the formatted HTML start tag
 */
export const formatElementTag = (
  startTag: string,
  options: HTMLTagFormatterOptions = {}
): React.ReactNode => {
  injectStyles();

  const { showFullContent = false, maxLength = 25, classNames = DEFAULT_CLASSES } = options;

  const tagMatch = startTag.match(/^<(\w+)([\s\S]*?)(\/?>)$/);
  if (!tagMatch) return startTag;

  const [, tagName, attributesStr, closing] = tagMatch;
  const { tag, attr, value, punctuation } = {
    ...DEFAULT_CLASSES,
    ...classNames,
  };

  const attributeParts: React.ReactNode[] = [];
  let match;
  const attrRegex = /\s+([^\s="]+)(?:(=")((?:\\"|[^"])*)")?/g;

  while ((match = attrRegex.exec(attributesStr)) !== null) {
    const [fullMatch, attrName, equals = '', attrValue = ''] = match;

    attributeParts.push(
      <React.Fragment key={attributeParts.length}>
        <span className={punctuation}> </span>
        <span className={attr}>{attrName}</span>
        {equals && (
          <>
            <span className={punctuation}>="</span>
            <span className={value} title={attrValue}>
              {showFullContent ? attrValue : truncateAttributeValue(attrValue, maxLength)}
            </span>
            <span className={punctuation}>"</span>
          </>
        )}
      </React.Fragment>
    );
  }

  return (
    <>
      <span className={punctuation}>&lt;</span>
      <span className={tag}>{tagName}</span>
      {attributeParts}
      <span className={punctuation}>{closing}</span>
    </>
  );
};
