import { Check, Plus, Search, X } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { Logger } from '../lib/logger';
import { ElementInfo, StyleModification } from '../types/domSelection';
import { Card } from './Card';
import './StyleEditor.css';

interface StyleEditorProps {
  /** The currently selected element */
  selectedElement: ElementInfo | null;
  /** Callback function to handle style modifications */
  onStylesChange?: (modifications: StyleModification[]) => void;
}

// Utility functions
const isValidCSSProperty = (property: string): boolean => {
  return property in document.body.style;
};

/**
 * Component to render a style editor for modifying element styles
 * @param selectedElement - The currently selected element
 * @param onStylesChange - Callback function to handle style changes
 * @returns A React element representing the style editor
 */
export const StyleEditor: React.FC<StyleEditorProps> = ({ selectedElement, onStylesChange }) => {
  // State declarations
  const [searchTerm, setSearchTerm] = useState('');
  const [editedStyles, setEditedStyles] = useState<Record<string, string>>({});
  const [newProperty, setNewProperty] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Utility instances
  const logger = new Logger('StyleEditor');

  // Memoized functions that depend on props or state
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
        //
        // Apply the new style to selected element
        // Under development
        //
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
      <Card title="Style Editor" initialCollapsed={true}>
        <div className="style-editor-empty"> {chrome.i18n.getMessage('styleEditorEmptyState')}</div>
      </Card>
    );
  }

  // Main render
  return (
    <Card title="Style Editor" initialCollapsed={true}>
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
    </Card>
  );
};
