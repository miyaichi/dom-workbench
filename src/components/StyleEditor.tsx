import { Check, Plus, RotateCcw, Search, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Logger } from '../lib/logger';
import { ElementInfo } from '../types/types';
import { Card } from './common/Card';
import { Tooltip } from './common/Tooltip';

interface StyleEditorProps {
  selectedElement: ElementInfo | null;
  onStyleChange: (property: string, value: string, oldValue: string) => void;
  onUndoStyleChange: () => void;
  styleChanges: StyleChange[];
}

interface StyleChange {
  id: string;
  timestamp: number;
  property: keyof CSSStyleDeclaration;
  oldValue: string;
  newValue: string;
}

const isValidCSSProperty = (property: string): boolean => {
  return property in document.body.style;
};

export const StyleEditor: React.FC<StyleEditorProps> = ({
  selectedElement,
  onStyleChange,
  onUndoStyleChange,
  styleChanges,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [newProperty, setNewProperty] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [currentStyles, setCurrentStyles] = useState<Record<string, string>>({});
  const [focusValue, setFocusValue] = useState<string | null>(null);

  const logger = new Logger('StyleEditor');

  React.useEffect(() => {
    if (selectedElement?.computedStyle) {
      const initialStyles = Object.fromEntries(
        Object.entries(selectedElement.computedStyle)
          .filter(
            ([key]) =>
              typeof key === 'string' &&
              isNaN(Number(key)) &&
              typeof selectedElement.computedStyle[key as keyof CSSStyleDeclaration] !== 'function'
          )
          .map(([key, value]) => [key, String(value)])
      );
      setCurrentStyles(initialStyles);
    }
  }, [selectedElement]);

  const handleStyleChange = (property: keyof CSSStyleDeclaration, value: string) => {
    if (!selectedElement?.computedStyle) return;

    setCurrentStyles((prev) => ({
      ...prev,
      [property]: value,
    }));
  };

  const handleStyleFocus = (property: keyof CSSStyleDeclaration) => {
    setFocusValue(currentStyles[property] || '');
  };

  const handleStyleBlur = (property: keyof CSSStyleDeclaration) => {
    if (focusValue === null) return;

    const newValue = currentStyles[property] || '';
    if (newValue === focusValue) return;

    onStyleChange?.(property as string, newValue, focusValue);
    setFocusValue(null);
  };

  const handleUndoLatest = () => {
    if (styleChanges.length === 0) return;
    onUndoStyleChange();
  };

  const handleAddStyle = () => {
    const trimmedProperty = newProperty.trim();
    const trimmedValue = newValue.trim();

    if (!trimmedProperty || !trimmedValue) return;

    if (isValidCSSProperty(trimmedProperty)) {
      const property = trimmedProperty as keyof CSSStyleDeclaration;
      const oldValue = currentStyles[property] || '';
      setCurrentStyles((prev) => ({
        ...prev,
        [property]: trimmedValue,
      }));

      onStyleChange(property as string, trimmedValue, oldValue);
      setNewProperty('');
      setNewValue('');
      setIsAdding(false);
    } else {
      logger.warn('Invalid CSS property:', trimmedProperty);
    }
  };

  const styleEntries = useMemo(() => {
    if (!selectedElement?.computedStyle) return [];

    return Object.entries(selectedElement.computedStyle)
      .filter(
        ([key]) =>
          typeof key === 'string' &&
          isNaN(Number(key)) &&
          typeof selectedElement.computedStyle[key as keyof CSSStyleDeclaration] !== 'function'
      )
      .filter(([key]) => key.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort(([a], [b]) => a.localeCompare(b));
  }, [selectedElement?.computedStyle, searchTerm]);

  if (!selectedElement?.computedStyle) {
    return (
      <Card title="Style Editor" initialCollapsed={true}>
        <div className="style-editor-empty">{chrome.i18n.getMessage('styleEditorEmptyState')}</div>
      </Card>
    );
  }

  return (
    <Card title="Style Editor" initialCollapsed={true}>
      <div className="style-editor">
        <div className="style-editor-search">
          <Search className="style-editor-search-icon" size={16} />
          <input
            type="text"
            placeholder="Search styles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="style-editor-search-input"
          />
        </div>

        {/* Style History Section */}
        {styleChanges.length > 0 && (
          <div className="style-history">
            <div className="style-history-header">
              <h4 className="style-history-title">Style Changes ({styleChanges.length})</h4>
              <Tooltip content={chrome.i18n.getMessage('styleHistoryUndoTooltip')}>
                <button
                  className="style-editor-button style-editor-button-secondary"
                  onClick={handleUndoLatest}
                  aria-label="Undo latest change"
                >
                  <RotateCcw size={16} />
                </button>
              </Tooltip>
            </div>
            {styleChanges.map((entry) => (
              <div key={entry.id} className="style-history-item">
                <div className="style-history-meta">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </div>
                <div className="style-history-content">
                  <span className="style-history-property">{entry.property}</span>
                  <span className="style-history-old">{entry.oldValue}</span>
                  <span className="style-history-arrow">→</span>
                  <span className="style-history-new">{entry.newValue}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Styles Section */}
        <div className="style-editor-content">
          <div className="style-editor-grid">
            {styleEntries.map(([property]) => (
              <React.Fragment key={property}>
                <div className="style-editor-property" title={property}>
                  {property}
                </div>
                <input
                  value={currentStyles[property] || ''}
                  onChange={(e) =>
                    handleStyleChange(property as keyof CSSStyleDeclaration, e.target.value)
                  }
                  onFocus={() => handleStyleFocus(property as keyof CSSStyleDeclaration)}
                  onBlur={() => handleStyleBlur(property as keyof CSSStyleDeclaration)}
                  className="style-editor-input"
                />
              </React.Fragment>
            ))}
          </div>

          {/* Add Style Section */}
          <div className="style-editor-add">
            {isAdding ? (
              <div className="style-editor-add-form">
                <input
                  placeholder="Property"
                  value={newProperty}
                  onChange={(e) => setNewProperty(e.target.value)}
                  className="style-editor-input"
                />
                <input
                  placeholder="Value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="style-editor-input"
                />
                <div className="style-editor-button-group">
                  <button
                    onClick={handleAddStyle}
                    className="style-editor-button style-editor-button-primary"
                    title="Add style"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => {
                      setIsAdding(false);
                      setNewProperty('');
                      setNewValue('');
                    }}
                    className="style-editor-button style-editor-button-danger"
                    title="Cancel"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAdding(true)}
                className="style-editor-button style-editor-button-primary"
                title="Add new style"
              >
                <Plus size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
