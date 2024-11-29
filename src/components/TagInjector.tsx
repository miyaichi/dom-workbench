import { AlertCircle, Send, Trash2 } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { Logger } from '../lib/logger';
import { ElementInfo } from '../types/domSelection';
import { formatElementTag } from '../utils/htmlTagFormatter';
import { validateHtmlTag } from '../utils/htmlValidator';
import { Card } from './common/Card';
import { Tooltip } from './common/Tooltip';

interface TagInjectorProps {
  /** The currently selected element */
  selectedElement: ElementInfo | null;
  /** Callback when a tag should be injected */
  onInjectTag?: (tag: string) => Promise<string>;
  /** Callback when a tag should be removed */
  onRemoveTag?: (tagId: string) => Promise<void>;
  /** Options for validating the injected tag */
  validateOptions?: {
    checkDangerousElements?: boolean;
  };
}

interface InjectedTagInfo {
  id: string;
  tag: string;
  timestamp: number;
}

export const TagInjector: React.FC<TagInjectorProps> = ({
  selectedElement,
  onInjectTag,
  onRemoveTag,
  validateOptions = { checkDangerousElements: false },
}: TagInjectorProps) => {
  const [injectedTag, setInjectedTag] = useState('');
  const [injectedTags, setInjectedTags] = useState<InjectedTagInfo[]>([]);
  const [isInjecting, setIsInjecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | undefined>(undefined);

  const logger = new Logger('TagInjector');

  const handleTagInput = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const newValue = e.target.value;
    setInjectedTag(newValue);
    setError(null);

    if (!newValue.trim()) {
      setValidationError(undefined);
      return;
    }

    try {
      const isValid = validateHtmlTag(newValue, validateOptions);
      setValidationError(
        isValid ? undefined : chrome.i18n.getMessage('tagInjectorValidationError')
      );
    } catch (err) {
      setValidationError((err as Error).message);
    }
  };

  const handleInject = useCallback(async () => {
    if (!onInjectTag || !injectedTag.trim() || validationError) return;

    setIsInjecting(true);
    setError(null);

    try {
      const tagId = await onInjectTag(injectedTag);
      setInjectedTags((prev) => [
        {
          id: tagId,
          tag: injectedTag,
          timestamp: Date.now(),
        },
        ...prev,
      ]);
      setInjectedTag('');
    } catch (err) {
      setError((err as Error).message);
      logger.error('Failed to inject tag:', err);
    } finally {
      setIsInjecting(false);
    }
  }, [injectedTag, onInjectTag, validationError]);

  const handleRemove = useCallback(
    async (tagInfo: InjectedTagInfo) => {
      if (!onRemoveTag) return;

      try {
        await onRemoveTag(tagInfo.id);
        setInjectedTags((prev) => prev.filter((t) => t.id !== tagInfo.id));
      } catch (err) {
        setError((err as Error).message);
        logger.error('Failed to remove tag:', err);
      }
    },
    [onRemoveTag]
  );

  if (!selectedElement) {
    return (
      <Card title="Tag Injector" initialCollapsed={true}>
        <div className="style-editor-empty">{chrome.i18n.getMessage('tagInjectorEmptyState')}</div>
      </Card>
    );
  }

  return (
    <Card title="Tag Injector" initialCollapsed={false}>
      <div className="tag-injector-content">
        <textarea
          value={injectedTag}
          onChange={handleTagInput}
          placeholder={chrome.i18n.getMessage('tagInjectorPlaceholder')}
          className={`injection-tag ${validationError ? 'error' : ''}`}
          spellCheck={false}
        />

        {(validationError || error) && (
          <div className="error-message">
            <AlertCircle size={16} className="inline-icon" />
            {validationError || error}
          </div>
        )}

        <div className="tag-injector-actions">
          <Tooltip
            content={
              validationError
                ? chrome.i18n.getMessage('tagInjectorValidationError')
                : chrome.i18n.getMessage('tagInjectorInjectTooltip')
            }
          >
            <button
              className="inject-button"
              onClick={handleInject}
              disabled={!injectedTag || !!validationError || isInjecting}
            >
              <Send size={16} />
              {isInjecting ? 'Injecting...' : 'Inject'}
            </button>
          </Tooltip>
        </div>

        {injectedTags.length > 0 && (
          <div className="injected-tags-list">
            <h4 className="injected-tags-title">Active Tags ({injectedTags.length})</h4>
            {injectedTags.map((tagInfo) => (
              <div key={tagInfo.id} className="injected-tag-item">
                <div className="injected-tag-preview">
                  {formatElementTag(tagInfo.tag, { maxLength: 30 })}
                  <div className="injected-tag-meta">
                    {new Date(tagInfo.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <Tooltip content={chrome.i18n.getMessage('tagInjectorRemoveTooltip')}>
                  <button
                    className="style-editor-button style-editor-button-danger"
                    onClick={() => handleRemove(tagInfo)}
                    aria-label="Remove tag"
                  >
                    <Trash2 size={16} />
                  </button>
                </Tooltip>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
