import { ChevronUp } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useConnectionManager } from '../lib/connectionManager';
import { Logger } from '../lib/logger';
import { DOM_SELECTION_EVENTS, ElementInfo, SelectElementPayload } from '../types/domSelection';
import './DOMSelector.css';
import { DOMTreeView } from './DOMTreeView';
import { Tooltip } from './Tooltip';

interface DOMSelectorProps {}

interface ElementSelectionMessage {
  payload: {
    elementInfo: ElementInfo;
  };
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
export const DOMSelector: React.FC<DOMSelectorProps> = () => {
  // State declarations
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const { subscribe, sendMessage } = useConnectionManager();
  const logger = new Logger('DOMSelector');

  // Event handlers
  const handleElementSelect = (elementInfo: ElementInfo): void => {
    sendMessage<SelectElementPayload>(DOM_SELECTION_EVENTS.SELECT_ELEMENT, {
      path: elementInfo.path,
    });
  };

  const handleParentSelect = (): void => {
    if (!selectedElement?.path.length) return;

    logger.log('Parent element selected');
    const parentPath = getParentPath(selectedElement.path);
    sendMessage<SelectElementPayload>(DOM_SELECTION_EVENTS.SELECT_ELEMENT, {
      path: parentPath,
    });
  };

  // Message subscriptions
  useEffect(() => {
    const subscriptions = [
      subscribe(DOM_SELECTION_EVENTS.ELEMENT_SELECTED, (message: ElementSelectionMessage) => {
        logger.log('Element selected:', message.payload.elementInfo);
        setSelectedElement(message.payload.elementInfo);
      }),

      subscribe(DOM_SELECTION_EVENTS.ELEMENT_UNSELECTED, () => {
        logger.log('Element unselected');
        setSelectedElement(null);
      }),
    ];

    // Clean up subscriptions
    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  // Main render
  if (!selectedElement) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">DOM Selector</h2>
        </div>
        <div className="style-editor-empty">{chrome.i18n.getMessage('domSelectorEmptyState')}</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">DOM Selector</h2>
      </div>
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
        <DOMTreeView elementInfo={selectedElement} onSelect={handleElementSelect} />
      </div>
    </div>
  );
};
