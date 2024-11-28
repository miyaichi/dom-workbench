import { Send, X } from 'lucide-react';
import React, { useState } from 'react';
import { formatElementTag } from '..//utils/htmlTagFormatter';
import { Logger } from '../lib/logger';
import { useSettings } from '../lib/settings';
import { shareAsPDF } from '../lib/shareAsPDF';
import { shareAsPPT } from '../lib/shareAsPPT';
import { ElementInfo, StyleModification } from '../types/domSelection';
import './ShareCapture.css';

interface ShareCaptureProps {
  /** Callback function to close the modal */
  onClose: () => void;
  /** The currently selected element */
  selectedElement: ElementInfo | null;
  /** The image data URL of the screen capture */
  imageDataUrl: string | null;
  /** The URL of the captured page */
  captureUrl: string | null;
  /** The style modifications applied to the selected element */
  styleModifications: StyleModification[];
}

// Utility functions
const getShareFunction = (format: string) => {
  return format === 'pdf' ? shareAsPDF : shareAsPPT;
};

const formatStyleModifications = (styleModifications: StyleModification[]) => {
  if (styleModifications.length === 0) return '';

  return styleModifications.map((mod) => `${mod.property}: ${mod.value}`).join('\n');
};

/**
 * Component to render a modal for sharing a screen capture
 * @param onClose - Callback function to close the modal
 * @param selectedElement - The currently selected element
 * @param imageDataUrl - The image data URL of the screen capture
 * @param captureUrl - The URL of the captured page
 * @param styleModifications - The style modifications applied to the selected element
 * @returns A React element representing the share capture modal
 */
export const ShareCapture: React.FC<ShareCaptureProps> = ({
  onClose,
  selectedElement,
  imageDataUrl,
  captureUrl,
  styleModifications,
}) => {
  // State declarations
  const { settings } = useSettings();
  const logger = new Logger('ShareCapture');

  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Event handlers
  const handleClose = (): void => {
    setComment('');
    onClose();
  };

  const handleShare = async (): Promise<void> => {
    if (!imageDataUrl) return;

    logger.debug('Sharing capture...');
    setIsLoading(true);

    try {
      const shareFunction = getShareFunction(settings.shareFormat);
      await shareFunction(
        imageDataUrl,
        comment,
        captureUrl || '',
        selectedElement?.startTag || '',
        formatStyleModifications(styleModifications)
      );

      logger.debug('Capture shared');
      handleClose();
    } catch (error) {
      logger.error('Failed to share:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setComment(e.target.value);
  };

  // UI rendering - preview section
  const renderPreview = () => {
    if (imageDataUrl) {
      return (
        <div className="capture-preview">
          <img src={imageDataUrl} alt="Screen Capture" className="capture-image" />
        </div>
      );
    }

    return (
      <div className="capture-preview">
        <p>Capturing screen...</p>
      </div>
    );
  };

  // UI rendering - element info section
  const renderElementInfo = () => {
    return (
      <>
        {captureUrl && (
          <div className="element-info">
            <p>{captureUrl}</p>
          </div>
        )}

        {selectedElement && (
          <div className="element-info">
            <p>[ {selectedElement.path.join(' > ')} ]</p>
            <p>
              {formatElementTag(selectedElement.startTag, {
                showFullContent: true,
                maxLength: 50,
              })}
            </p>
          </div>
        )}
      </>
    );
  };

  // Main render
  return (
    <div className="capture-modal">
      <div className="capture-container">
        <div className="capture-header">
          <h2 className="capture-title">Share Capture</h2>
          <button onClick={handleClose} className="capture-close">
            <X size={20} />
          </button>
        </div>

        {renderPreview()}

        <textarea
          value={comment}
          onChange={handleCommentChange}
          placeholder="Add a comment..."
          className="capture-comment"
        />

        {renderElementInfo()}

        <div className="capture-actions">
          <button onClick={handleShare} className="share-button" disabled={!imageDataUrl}>
            <Send size={16} />
            {isLoading ? 'Sharing...' : `Share as ${settings.shareFormat.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
};
