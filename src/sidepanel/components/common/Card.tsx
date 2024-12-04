import { ChevronDown, ChevronUp } from 'lucide-react';
import React, { useState } from 'react';
import { Tooltip } from './Tooltip';

interface CardProps {
  /** The title of the card */
  title: string;
  /** The content of the card */
  children: React.ReactNode;
  /** Whether the card should be collapsed by default */
  initialCollapsed?: boolean;
}

/**
 * Card component that displays a collapsible card with a title and content
 * @param title - The title of the card
 * @param children - The content of the card
 * @param initialCollapsed - Whether the card should be collapsed by default
 * @returns A React element representing the card
 */
export const Card: React.FC<CardProps> = ({ title, children, initialCollapsed = false }) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">{title}</h2>
        <div className="card-actions">
          <Tooltip
            content={
              isCollapsed ? chrome.i18n.getMessage('expand') : chrome.i18n.getMessage('collapse')
            }
          >
            <button onClick={() => setIsCollapsed(!isCollapsed)} className="card-button">
              {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </Tooltip>
        </div>
      </div>
      {!isCollapsed && <div className="card-content">{children}</div>}
    </div>
  );
};
