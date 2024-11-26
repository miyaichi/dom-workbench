import React, { useEffect, useState } from 'react';
import { useConnectionManager } from '../lib/connectionManager';
import { Logger } from '../lib/logger';
import { ElementInfo } from '../types/domSelection';
import { Card } from './Card';
import './TagInjector.css';

interface TagInjectorProps {}

interface ElementSelectionMessage {
  payload: {
    elementInfo: ElementInfo;
  };
}

export const TagInjector: React.FC<TagInjectorProps> = () => {
  // State declarations
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [injectedTag, setInjectedTag] = useState('');
  const [injected, setInjected] = useState(false);

  // Utility instances
  const { subscribe, sendMessage } = useConnectionManager();
  const logger = new Logger('StyleEditor');

  // Event handlers
  const handleInjectTag = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setInjectedTag(e.target.value);
  };

  // Message subscriptions
  useEffect(() => {
    const subscriptions = [
      subscribe('ELEMENT_SELECTED', (message: ElementSelectionMessage) => {
        logger.log('Element selected:', message.payload.elementInfo);
        setSelectedElement(message.payload.elementInfo);
      }),

      subscribe('ELEMENT_UNSELECTED', () => {
        logger.log('Element unselected');
        setSelectedElement(null);
      }),
    ];

    // Clean up subscriptions
    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  if (!selectedElement) {
    return (
      <Card title="TagInjector">
        <div className="style-editor-empty">{chrome.i18n.getMessage('tagInjectorEmptyState')}</div>
      </Card>
    );
  }

  return (
    <Card title="TagInjector">
      <textarea
        value={injectedTag}
        onChange={handleInjectTag}
        placeholder="Add a tag..."
        className="injection-tag"
      />
    </Card>
  );
};
