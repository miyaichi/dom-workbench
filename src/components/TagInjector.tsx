import React, { useState } from 'react';
import { Logger } from '../lib/logger';
import { ElementInfo } from '../types/domSelection';
import { Card } from './Card';
import './TagInjector.css';

interface TagInjectorProps {
  selectedElement: ElementInfo | null;
}

export const TagInjector: React.FC<TagInjectorProps> = ({ selectedElement }: TagInjectorProps) => {
  // State declarations
  const [injectedTag, setInjectedTag] = useState('');
  const [injected, setInjected] = useState(false);

  // Utility instances
  const logger = new Logger('StyleEditor');

  // Event handlers
  const handleInjectTag = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setInjectedTag(e.target.value);
  };

  if (!selectedElement) {
    return (
      <Card title="TagInjector" initialCollapsed={true}>
        <div className="style-editor-empty">{chrome.i18n.getMessage('tagInjectorEmptyState')}</div>
      </Card>
    );
  }

  return (
    <Card title="TagInjector" initialCollapsed={true}>
      <textarea
        value={injectedTag}
        onChange={handleInjectTag}
        placeholder="Add a tag..."
        className="injection-tag"
      />
    </Card>
  );
};
