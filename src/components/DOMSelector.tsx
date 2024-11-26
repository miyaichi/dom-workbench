import { ChevronUp } from 'lucide-react';
import React from 'react';
import { Logger } from '../lib/logger';
import { ElementInfo } from '../types/domSelection';
import { Card } from './Card';
import './DOMSelector.css';
import { DOMTreeView } from './DOMTreeView';
import { Tooltip } from './Tooltip';

interface DOMSelectorProps {
  selectedElement: ElementInfo | null;
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
 * @returns A React element representing the DOM selector
 */
export const DOMSelector: React.FC<DOMSelectorProps> = ({
  selectedElement, 
  onSelectElement 
}) => {
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

  // Main render
  if (!selectedElement) {
    return (
      <Card title="DOM Selector">
        <div className="style-editor-empty">{chrome.i18n.getMessage('domSelectorEmptyState')}</div>
      </Card>
    );
  }

  return (
    <Card title="DOM Selector">
      <div className="card-content">
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
      </div>
    </Card>
  );
};
