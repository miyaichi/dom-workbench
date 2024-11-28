// utils/htmlValidator.ts

/**
 * Interface defining HTML validation options
 */
interface ValidateHtmlTagOptions {
  /** Whether to check for dangerous elements (onclick attributes, javascript: URLs, etc.) */
  checkDangerousElements?: boolean;
}

/** Default validation options */
const DEFAULT_OPTIONS: ValidateHtmlTagOptions = {
  checkDangerousElements: false,
};

/**
 * Checks if a script tag has valid syntax
 *
 * @param htmlString - The HTML string to validate
 * @returns true if the script tag syntax is valid
 *
 * @example
 * ```ts
 * isValidScriptTag('<script src="example.js"></script>'); // true
 * isValidScriptTag('<script>'); // false
 * ```
 */
const isValidScriptTag = (htmlString: string): boolean => {
  const scriptPattern = /^<script(?:\s+[^>]*)?>\s*<\/script>$/i;
  return scriptPattern.test(htmlString);
};

/**
 * Performs basic HTML syntax validation
 *
 * @param htmlString - The HTML string to validate
 * @returns true if the HTML syntax is valid
 *
 * @remarks
 * Checks the following:
 * - Matching opening and closing tags
 * - Invalid '<' characters
 * - Uses specialized validation for script tags
 */
const basicValidation = (htmlString: string): boolean => {
  if (htmlString.trim().toLowerCase().startsWith('<script')) {
    return isValidScriptTag(htmlString);
  }

  const openTags: string[] = htmlString.match(/<[^/][^>]*>/g) || [];
  const closeTags: string[] = htmlString.match(/<\/[^>]+>/g) || [];
  const selfClosingTags: string[] = htmlString.match(/<[^>]+\/>/g) || [];
  const normalOpenTags = openTags.filter((tag) => !selfClosingTags.includes(tag));

  if (normalOpenTags.length !== closeTags.length) {
    return false;
  }

  const invalidLtCount = (htmlString.match(/</g) || []).length;
  const validTagCount = openTags.length + closeTags.length + selfClosingTags.length;

  return invalidLtCount <= validTagCount;
};

/**
 * Checks if HTML string contains dangerous elements
 *
 * @param htmlString - The HTML string to check
 * @returns true if dangerous elements are found
 *
 * @remarks
 * The following are considered dangerous:
 * - onclick attributes
 * - href attributes starting with javascript:
 */
const containsDangerousElements = (htmlString: string): boolean => {
  const hasOnClickAttr = /onclick\s*=\s*["'].*?["']/i.test(htmlString);
  const hasJavaScriptHref = /href\s*=\s*["']javascript:.*?["']/i.test(htmlString);

  return hasOnClickAttr || hasJavaScriptHref;
};

/**
 * Validates an HTML string
 *
 * @param htmlString - The HTML string to validate
 * @param options - Validation options
 * @returns true if the HTML string is valid
 *
 * @example
 * ```ts
 * // Basic usage
 * validateHtmlTag('<div>Hello</div>'); // true
 *
 * // With dangerous elements check
 * validateHtmlTag('<div onclick="alert()">Click</div>', { checkDangerousElements: true }); // false
 *
 * // Script tag validation
 * validateHtmlTag('<script src="example.js"></script>'); // true
 * ```
 *
 * @remarks
 * Validates the following:
 * 1. Basic HTML syntax
 * 2. Presence of dangerous elements (optional)
 * 3. DOMParser parsing result
 * 4. Single root element
 * 5. Input/output match
 */
export const validateHtmlTag = (
  htmlString: string,
  options: ValidateHtmlTagOptions = DEFAULT_OPTIONS
): boolean => {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const trimmedHtml = htmlString.trim();

  if (!trimmedHtml) return false;

  // Special handling for script tags
  if (trimmedHtml.toLowerCase().startsWith('<script')) {
    const isValid = isValidScriptTag(trimmedHtml);
    return isValid && !mergedOptions.checkDangerousElements;
  }

  if (!basicValidation(trimmedHtml)) {
    return false;
  }

  if (mergedOptions.checkDangerousElements && containsDangerousElements(trimmedHtml)) {
    return false;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(trimmedHtml, 'text/html');

  if (doc.querySelector('parsererror')) {
    return false;
  }

  // Additional checks for non-script tags
  if (!trimmedHtml.toLowerCase().startsWith('<script')) {
    const bodyContent = doc.body.children;
    if (bodyContent.length !== 1) {
      return false;
    }

    const normalize = (str: string) => str.trim().toLowerCase().replace(/\s+/g, ' ');
    const normalizedInput = normalize(trimmedHtml);
    const normalizedOutput = normalize(doc.body.innerHTML);

    if (normalizedInput !== normalizedOutput) {
      return false;
    }
  }

  return true;
};
