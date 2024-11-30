interface ScriptInfo {
  placeholder: string;
  element: HTMLScriptElement;
  isExternal: boolean;
  order: number;
}

interface ProcessedHtml {
  htmlWithoutScripts: string;
  extractedScripts: ScriptInfo[];
}

interface HtmlToDocOptions {
  async?: boolean;
  preserveOrder?: boolean;
  onScriptsLoaded?: () => void;
}

/**
 * Converts HTML string to DOM, handling scripts appropriately
 * @param htmlString HTML string to convert
 * @param options Configuration for script handling
 * @returns Promise<Node | DocumentFragment>
 */
export const htmlToDoc = async (
  htmlString: string,
  options: HtmlToDocOptions = {}
): Promise<Node | DocumentFragment> => {
  const {
    async = false,
    preserveOrder = true,
    onScriptsLoaded
  } = options;

  const parseHtml = (html: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return doc.body.innerHTML;
  };

  const extractScriptsWithPlaceholders = (html: string): ProcessedHtml => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const extractedScripts: ScriptInfo[] = [];
    const scripts = tempDiv.getElementsByTagName('script');

    Array.from(scripts).forEach((script, index) => {
      const placeholder = `script-placeholder-${index}`;
      const placeholderElement = document.createElement('span');
      placeholderElement.setAttribute('data-script-placeholder', placeholder);

      const scriptClone = document.createElement('script');
      const isExternal = script.hasAttribute('src');

      Array.from(script.attributes).forEach((attr) => {
        scriptClone.setAttribute(attr.name, attr.value);
      });

      if (script.textContent) {
        scriptClone.textContent = script.textContent;
      }

      extractedScripts.push({
        placeholder,
        element: scriptClone,
        isExternal,
        order: index
      });

      script.parentNode?.replaceChild(placeholderElement, script);
    });

    return {
      htmlWithoutScripts: tempDiv.innerHTML,
      extractedScripts,
    };
  };

  const loadScript = (scriptInfo: ScriptInfo): Promise<void> => {
    return new Promise((resolve, reject) => {
      const { element } = scriptInfo;

      if (scriptInfo.isExternal) {
        element.onload = () => resolve();
        element.onerror = (error) => reject(error);
      } else {
        resolve();
      }
    });
  };

  const replacePlaceholdersWithScripts = async (
    container: Element | DocumentFragment,
    scripts: ScriptInfo[]
  ): Promise<void> => {
    if (!async) {
      scripts.forEach(({ placeholder, element }) => {
        const placeholderElement = container.querySelector(
          `[data-script-placeholder="${placeholder}"]`
        );
        if (placeholderElement?.parentNode) {
          placeholderElement.parentNode.replaceChild(element, placeholderElement);
        }
      });
      return;
    }

    const loadPromises: Promise<void>[] = [];

    if (preserveOrder) {
      for (const script of scripts) {
        const placeholderElement = container.querySelector(
          `[data-script-placeholder="${script.placeholder}"]`
        );
        if (placeholderElement?.parentNode) {
          script.element.async = false;
          placeholderElement.parentNode.replaceChild(script.element, placeholderElement);
          await loadScript(script);
        }
      }
    } else {
      scripts.forEach((script) => {
        const placeholderElement = container.querySelector(
          `[data-script-placeholder="${script.placeholder}"]`
        );
        if (placeholderElement?.parentNode) {
          script.element.async = true;
          placeholderElement.parentNode.replaceChild(script.element, placeholderElement);
          loadPromises.push(loadScript(script));
        }
      });
      await Promise.all(loadPromises);
    }

    onScriptsLoaded?.();
  };

  try {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = parseHtml(htmlString);

    const { htmlWithoutScripts, extractedScripts } = extractScriptsWithPlaceholders(
      tempDiv.innerHTML
    );
    tempDiv.innerHTML = htmlWithoutScripts;

    let result: Node | DocumentFragment;
    if (tempDiv.childNodes.length === 1) {
      result = tempDiv.firstChild as Node;
    } else {
      result = document.createDocumentFragment();
      while (tempDiv.firstChild) {
        result.appendChild(tempDiv.firstChild);
      }
    }

    await replacePlaceholdersWithScripts(result as Element | DocumentFragment, extractedScripts);

    return result;
  } catch (error) {
    console.error('Failed to convert HTML to DOM:', error);
    return document.createDocumentFragment();
  }
};

/**
 * Helper function to insert HTML with scripts into a target element
 */
export const insertTag = async (
  tagContent: string,
  targetElement: Element,
  options?: HtmlToDocOptions
): Promise<boolean> => {
  try {
    const domElement = await htmlToDoc(tagContent, options);
    targetElement.appendChild(domElement);
    return true;
  } catch (error) {
    console.error('Failed to insert ad tag:', error);
    return false;
  }
};