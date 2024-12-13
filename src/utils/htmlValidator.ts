export const isValidHtmlString = (htmlString: string): boolean => {
  try {
    // Basic check of the input value
    if (!htmlString || typeof htmlString !== 'string') {
      return false;
    }

    const trimmed = htmlString.trim();
    if (!trimmed) return false;

    // Plain text check
    if (!trimmed.startsWith('<') && !trimmed.endsWith('>')) {
      return false;
    }

    // Comment only
    if (trimmed.startsWith('<!--') && trimmed.endsWith('-->')) {
      return true;
    }

    // Remove comments
    const withoutComments = trimmed.replace(/<!--[\s\S]*?-->/g, '').trim();
    if (!withoutComments) return true;

    // Additional allowed tags (ad-related)
    const adRelatedTags = ['ins', 'amp-ad', 'amp-embed'];

    // Helper function to validate tag names
    const isValidTagName = (tagName: string): boolean => {
      try {
        // Ad-related tags are allowed, but other tags must be valid HTML elements
        if (adRelatedTags.includes(tagName.toLowerCase() as any)) {
          return true;
        }
        return (
          document.createElement(tagName.toLowerCase()).toString() !== '[object HTMLUnknownElement]'
        );
      } catch {
        return false;
      }
    };

    // Extract and validate tag names
    const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9-]*)/g;
    let match;
    while ((match = tagPattern.exec(withoutComments)) !== null) {
      if (!isValidTagName(match[1])) {
        return false;
      }
    }

    // Analyze with DOMParser
    const parser = new DOMParser();
    const doc = parser.parseFromString(withoutComments, 'text/html');

    // Check for parser errors
    const parserErrors = doc.getElementsByTagName('parsererror');
    if (parserErrors.length > 0) {
      return false;
    }

    // Normalize the script content
    const normalizeScript = (content: string): string => {
      return content
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/;\s+/g, ';')
        .replace(/\s*=\s*/g, '=')
        .replace(/\s*\(\s*/g, '(')
        .replace(/\s*\)\s*/g, ')')
        .replace(/\s*{\s*/g, '{')
        .replace(/\s*}\s*/g, '}')
        .replace(/\s*\|\|\s*/g, '||')
        .toLowerCase();
    };

    // Extract script content from the HTML string
    const extractScripts = (html: string): string[] => {
      const scripts: string[] = [];
      const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
      let scriptMatch;
      while ((scriptMatch = scriptRegex.exec(html)) !== null) {
        scripts.push(normalizeScript(scriptMatch[1]));
      }
      return scripts;
    };

    // Normalize the HTML string
    const normalizeHtml = (html: string): string => {
      // Boolean attribute normalization
      const normalizeBooleanAttrs = (str: string): string => {
        const booleanAttrs = ['required', 'checked', 'disabled', 'readonly', 'multiple', 'selected'];
        booleanAttrs.forEach((attr) => {
          const regex = new RegExp(`${attr}=""`, 'g');
          str = str.replace(regex, attr);
        });
        return str;
      };

      return normalizeBooleanAttrs(
        html
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .replace(/\s*\/>/g, '>')
          .replace(/\s*>/g, '>')
          .replace(/\s*</g, '<')
          .replace(/\s*=/g, '=')
          .replace(/=\s*/g, '=')
          .replace(/"\s*/g, '"')
          .replace(/\s*"/g, '"')
          .replace(/>\s*</g, '><')
          .replace(/data-[a-z0-9-]+/g, (match) => match.toLowerCase())
      );
    };

    // Script tags require special handling
    if (withoutComments.includes('<script')) {
      const scriptElements = doc.getElementsByTagName('script');
      if (scriptElements.length === 0) return false;

      // Extract and normalize the script content
      const inputScripts = extractScripts(withoutComments);
      const outputScripts = Array.from(scriptElements).map((script) =>
        normalizeScript(script.textContent || '')
      );

      // If the number of scripts does not match, it is invalid
      if (inputScripts.length !== outputScripts.length) {
        return false;
      }

      // Check each script
      for (let i = 0; i < inputScripts.length; i++) {
        const inputScript = inputScripts[i];
        const outputScript = outputScripts[i];

        // Check if the script contains Google Ads tags
        if (inputScript.includes('adsbygoogle') || outputScript.includes('adsbygoogle')) {
          try {
            // Basic syntax check
            new Function(inputScript);
            if (/[<>]/.test(inputScript) || /[<>]/.test(outputScript)) {
              return false;
            }
            // Check for the presence of major keywords
            if (!inputScript.includes('push') || !outputScript.includes('push')) {
              return false;
            }
          } catch {
            // If there is a syntax error, it is invalid
            return false;
          }
          continue;
        }

        // Normalize the script content and compare
        const normalizedInput = inputScript.replace(/\s+/g, '');
        const normalizedOutput = outputScript.replace(/\s+/g, '');
        if (normalizedInput !== normalizedOutput) {
          return false;
        }
      }

      // Validate the non-script part
      const withoutScripts = withoutComments.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
      const bodyWithoutScripts = doc.body.innerHTML.replace(
        /<script\b[^>]*>[\s\S]*?<\/script>/gi,
        ''
      );

      const normalizedInput = normalizeHtml(withoutScripts);
      const normalizedOutput = normalizeHtml(bodyWithoutScripts);

      return normalizedInput === normalizedOutput;
    }

    // Basic HTML validation
    const bodyContent = doc.body.innerHTML;
    const normalizedInput = normalizeHtml(withoutComments);
    const normalizedOutput = normalizeHtml(bodyContent);

    return normalizedInput === normalizedOutput;
  } catch (error) {
    return false;
  }
};
