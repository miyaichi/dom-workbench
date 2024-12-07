import { ChevronUp, Clipboard, ClipboardCheck } from 'lucide-react';
import React, { useState } from 'react';
import { Logger } from '../../lib/logger';
import { ElementInfo } from '../../types/types';
import { elementInfoToHTML } from '../../utils/elementInfoToHTML';
import { Card } from './common/Card';
import { DOMTreeView } from './common/DOMTreeView';
import { Tooltip } from './common/Tooltip';

interface DOMSelectorProps {
  /** The currently selected element */
  selectedElement: ElementInfo | null;
  /** Callback function to handle element selection */
  onSelectElement: (path: number[]) => void;
}

// Utility functions
const hasParentElement = (element: ElementInfo): boolean => {
  return element.path.length > 0;
};

const getParentPath = (path: number[]): number[] => {
  return path.slice(0, -1);
};

export const DOMSelector: React.FC<DOMSelectorProps> = ({ selectedElement, onSelectElement }) => {
  const logger = new Logger('DOMSelector');
  const [isCopied, setIsCopied] = useState(false);

  const handleElementInfoSelect = (elementInfo: ElementInfo): void => {
    logger.info('Element selected:', elementInfo);
    onSelectElement(elementInfo.path);
  };

  const handleParentSelect = (): void => {
    if (!selectedElement?.path.length) return;

    logger.info('Parent element selected');
    const parentPath = getParentPath(selectedElement.path);
    onSelectElement(parentPath);
  };

  const handleCopyHTML = async (): Promise<void> => {
    if (!selectedElement) return;

    try {
      const htmlString = elementInfoToHTML(selectedElement);
      await navigator.clipboard.writeText(htmlString);

      // Set the copied state to true and then reset it after 2 seconds
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);

      logger.info('HTML copied to clipboard');
    } catch (error) {
      logger.error('Failed to copy HTML:', error);
    }
  };

  if (!selectedElement) {
    return (
      <Card title="DOM Selector">
        <div className="style-editor-empty">{chrome.i18n.getMessage('domSelectorEmptyState')}</div>
      </Card>
    );
  }

  return (
    <Card title="DOM Selector">
      <div className="selected-element-info">
        <div className="element-header">
          <h3>Selected Element:</h3>
          <div className="header-actions">
            {hasParentElement(selectedElement) && (
              <Tooltip content={chrome.i18n.getMessage('tooltipParentElement')}>
                <button onClick={handleParentSelect} className="parent-nav-button">
                  <ChevronUp size={16} />
                </button>
              </Tooltip>
            )}
            <Tooltip
              content={
                isCopied
                  ? chrome.i18n.getMessage('copiedToClipboard')
                  : chrome.i18n.getMessage('copyToClipboard')
              }
            >
              <button
                onClick={handleCopyHTML}
                className={`icon-button ${isCopied ? 'icon-button-success' : ''}`}
              >
                {isCopied ? <ClipboardCheck size={16} /> : <Clipboard size={16} />}
              </button>
            </Tooltip>
          </div>
        </div>
        <Tooltip content={chrome.i18n.getMessage('labelDOMPath')}>
          <div className="element-path">{selectedElement.path.join(' > ')}</div>
        </Tooltip>
      </div>
      <DOMTreeView elementInfo={selectedElement} onSelect={handleElementInfoSelect} />
    </Card>
  );
};
