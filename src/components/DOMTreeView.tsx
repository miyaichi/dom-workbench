// DOMTreeView.tsx
import { ChevronDown, ChevronRight } from 'lucide-react';
import React, { useState } from 'react';
import { ElementInfo } from '../types/domSelection';
import './DOMTreeView.css';
import { Tooltip } from './Tooltip';
import { formatElementTag } from './utils/htmlTagFormatter';

interface Props {
  /** The element information to display in the tree view */
  elementInfo: ElementInfo;
  /** Callback function to handle node selection */
  onSelect?: (node: ElementInfo) => void;
}

/**
 * Component to render a tree view of DOM elements
 * @param elementInfo - The element information to display in the tree view
 * @param onSelect - Callback function to handle node selection
 * @returns A React element representing the DOM tree view
 */
export const DOMTreeView = ({ elementInfo, onSelect }: Props) => {
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);

  const toggleNode = (path: string) => {
    setExpandedNodes((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const renderNode = (node: ElementInfo, parentPath = '') => {
    const currentPath = parentPath ? `${parentPath}-${node.path.join('.')}` : node.path.join('.');
    const isExpanded = expandedNodes.includes(currentPath);
    const hasChildren = node.children.length > 0;

    return (
      <div key={currentPath} className="tree-node">
        <div className="tree-node-content">
          {hasChildren ? (
            <Tooltip
              content={
                isExpanded
                  ? chrome.i18n.getMessage('tooltipCollapse')
                  : chrome.i18n.getMessage('tooltipExpand')
              }
            >
              <div className="tree-chevron" onClick={() => toggleNode(currentPath)}>
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
            </Tooltip>
          ) : (
            <div className="tree-chevron-placeholder" />
          )}
          <div className="tree-tag-container">
            <Tooltip content={node.startTag}>
              <span className="tree-tag" onClick={() => onSelect?.(node)}>
                {formatElementTag(node.startTag)}
              </span>
            </Tooltip>
          </div>
        </div>
        {isExpanded && hasChildren && (
          <div className="tree-children">
            {node.children.map((child) => renderNode(child, currentPath))}
          </div>
        )}
      </div>
    );
  };

  return <div className="dom-tree-view">{renderNode(elementInfo)}</div>;
};
