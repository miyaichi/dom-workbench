import { Send } from 'lucide-react';
import React, { useState } from 'react';
import { Logger } from '../lib/logger';
import { ElementInfo } from '../types/domSelection';
import { validateHtmlTag } from '../utils/htmlValidator';
import { Card } from './Card';
import './TagInjector.css';

interface TagInjectorProps {
  selectedElement: ElementInfo | null;
  validateOptions?: {
    checkDangerousElements?: boolean;
  };
}

export const TagInjector: React.FC<TagInjectorProps> = ({
  selectedElement,
  validateOptions = { checkDangerousElements: false },
}: TagInjectorProps) => {
  // State declarations
  const [injectedTag, setInjectedTag] = useState('');
  const [injected, setInjected] = useState(false);
  const [validationError, setValidationError] = useState<boolean | undefined>(undefined);

  // Utility instances
  const logger = new Logger('TagInjector');

  // Event handlers
  const handleInjectTag = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const newValue = e.target.value;
    setInjectedTag(newValue);
    
    if (!newValue.trim()) {
      setValidationError(undefined);
      return;
    }

    const isValid = validateHtmlTag(newValue, validateOptions);
    setValidationError(!isValid);
  };

  const handleOnClick = (): void => {
    setInjected(!injected);
  };

  if (!selectedElement) {
    return (
      <Card title="Tag Injector" initialCollapsed={true}>
        <div className="style-editor-empty">{chrome.i18n.getMessage('tagInjectorEmptyState')}</div>
      </Card>
    );
  }

  return (
    <Card title="Tag Injector" initialCollapsed={true}>
      <textarea
        value={injectedTag}
        onChange={handleInjectTag}
        placeholder="Add a tag..."
        className={`injection-tag ${validationError ? 'error' : ''}`}
      />
      {validationError && (
        <div className="error-message">
          {chrome.i18n.getMessage('tagInjectorValidationError')}
        </div>
      )}
      <button
        className="inject-button"
        onClick={handleOnClick}
        disabled={injectedTag.length === 0 || validationError}
      >
        <Send size={16} />
        {injected ? 'Remove' : 'Inject'}
      </button>
    </Card>
  );
};