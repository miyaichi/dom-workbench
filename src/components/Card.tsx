import { ChevronDown, ChevronUp } from 'lucide-react';
import React, { useState } from 'react';
import './Card.css';

interface CardProps {
  title: string;
  children: React.ReactNode;
  initialCollapsed?: boolean;
  onClose?: () => void;
}

export const Card: React.FC<CardProps> = ({ title, children, initialCollapsed = false }) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">{title}</h2>
        <div className="card-actions">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="card-button"
            aria-label={isCollapsed ? '展開' : '収納'}
          >
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>
      {!isCollapsed && <div className="card-content">{children}</div>}
    </div>
  );
};
