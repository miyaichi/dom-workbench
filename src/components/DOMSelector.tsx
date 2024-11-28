import { ChevronUp } from 'lucide-react';
import React from 'react';
import { Logger } from '../lib/logger';
import { ElementInfo } from '../types/domSelection';
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

/**
 * DOMSelector component that allows users to select and navigate DOM elements
 * @param selectedElement - The currently selected element
 * @param onSelectElement - Callback function to handle element selection
 * @returns A React element representing the DOM selector
 */
export const DOMSelector: React.FC<DOMSelectorProps> = ({ selectedElement, onSelectElement }) => {
  const logger = new Logger('DOMSelector');

  // Event handlers
  const handleElementInfoSelect = (elementInfo: ElementInfo): void => {
    logger.log('Element selected:', elementInfo);
    onSelectElement(elementInfo.path);
  };

  const handleParentSelect = (): void => {
    if (!selectedElement?.path.length) return;

    logger.log('Parent element selected');
    const parentPath = getParentPath(selectedElement.path);
    onSelectElement(parentPath);
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
          {hasParentElement(selectedElement) && (
            <Tooltip content={chrome.i18n.getMessage('tooltipParentElement')}>
              <button onClick={handleParentSelect} className="parent-nav-button">
                <ChevronUp size={16} />
              </button>
            </Tooltip>
          )}
        </div>
        <Tooltip content={chrome.i18n.getMessage('labelDOMPath')}>
          <div className="element-path">{selectedElement.path.join(' > ')}</div>
        </Tooltip>
      </div>
      <DOMTreeView elementInfo={selectedElement} onSelect={handleElementInfoSelect} />
    </Card>
  );
};
