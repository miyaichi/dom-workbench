import { Check, Plus, Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useConnectionManager } from '../lib/connectionManager';
import { Logger } from '../lib/logger';
import { DOM_SELECTION_EVENTS, ElementInfo, StyleModification } from '../types/domSelection';
import './StyleEditor.css';

interface StyleEditorProps {
  onStylesChange?: (modifications: StyleModification[]) => void;
}

interface ElementSelectionMessage {
  payload: {
    elementInfo: ElementInfo;
  };
}

// Utility functions
const isValidCSSProperty = (property: string): boolean => {
  return property in document.body.style;
};

export const StyleEditor: React.FC<StyleEditorProps> = ({ onStylesChange }) => {
  // State declarations
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editedStyles, setEditedStyles] = useState<Record<string, string>>({});
  const [newProperty, setNewProperty] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Utility instances
  const { subscribe, sendMessage } = useConnectionManager();
  const logger = new Logger('StyleEditor');

  // Memoized functions that depend on props or state
  const updateElementStyle = useCallback(
    (property: keyof CSSStyleDeclaration, value: string) => {
      sendMessage(DOM_SELECTION_EVENTS.UPDATE_ELEMENT_STYLE, {
        path: selectedElement?.path,
        styles: {
          [property]: value,
        },
      });
      logger.log('Style updated:', property, value);
    },
    [selectedElement?.path, sendMessage]
  );

  const notifyStyleChanges = useCallback(
    (newStyles: Record<string, string>) => {
      const modifications = Object.entries(newStyles).map(([prop, val]) => ({
        property: prop,
        value: val,
      }));
      logger.log('Styles changed:', modifications);
      onStylesChange?.(modifications);
    },
    [onStylesChange]
  );

  // Non-memoized functions (simple state updates or no external dependencies)
  const resetStyleEditorState = () => {
    setEditedStyles({});
    setIsAdding(false);
    setNewProperty('');
    setNewValue('');
  };

  const handleStyleChange = (property: keyof CSSStyleDeclaration, value: string) => {
    setEditedStyles((prevStyles) => {
      const currentValue = selectedElement?.computedStyle?.[property] as string;
      const previousEditedValue = prevStyles[property];

      if (value !== currentValue && value !== previousEditedValue) {
        const newStyles = {
          ...prevStyles,
          [property]: value,
        };

        setTimeout(() => notifyStyleChanges(newStyles), 0);
        updateElementStyle(property, value);
        return newStyles;
      }

      return prevStyles;
    });
  };

  const handleAddStyle = () => {
    const trimmedProperty = newProperty.trim();
    const trimmedValue = newValue.trim();

    if (!trimmedProperty || !trimmedValue) return;

    if (isValidCSSProperty(trimmedProperty)) {
      logger.log('Adding new style:', trimmedProperty, trimmedValue);
      handleStyleChange(trimmedProperty as keyof CSSStyleDeclaration, trimmedValue);
      setNewProperty('');
      setNewValue('');
      setIsAdding(false);
    } else {
      logger.warn('Invalid CSS property:', trimmedProperty);
    }
  };

  // Message subscriptions
  useEffect(() => {
    const subscriptions = [
      subscribe(DOM_SELECTION_EVENTS.ELEMENT_SELECTED, (message: ElementSelectionMessage) => {
        logger.log('Element selected:', message.payload.elementInfo);
        setSelectedElement(message.payload.elementInfo);
        resetStyleEditorState();
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

  // Memoized computed values
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

  // Render empty state
  if (!selectedElement?.computedStyle) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Style Editor</h2>
        </div>
        <div className="style-editor-empty"> {chrome.i18n.getMessage('styleEditorEmptyState')}</div>
      </div>
    );
  }

  // Main render
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Style Editor</h2>
      </div>
      <div className="style-editor">
        {/* Search Section */}
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

        <div className="style-editor-content">
          {/* Style Grid */}
          <div className="style-editor-grid">
            {styleEntries.map(([property, value]) => (
              <React.Fragment key={property}>
                <div className="style-editor-property" title={property}>
                  {property}
                </div>
                <input
                  key={property}
                  defaultValue={editedStyles[property] ?? String(value)}
                  onBlur={(e) =>
                    handleStyleChange(property as keyof CSSStyleDeclaration, e.target.value)
                  }
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
    </div>
  );
};
