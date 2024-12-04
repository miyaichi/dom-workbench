import { Send, X } from 'lucide-react';
import React, { useState } from 'react';
import { Logger } from '../../lib/logger';
import { useSettings } from '../../lib/settings';
import { shareAsPDF } from '../../lib/shareAsPDF';
import { shareAsPPT } from '../../lib/shareAsPPT';
import { ElementInfo } from '../../types/types';
import { formatElementTag } from '../../utils/htmlTagFormatter';
import './ShareCapture.css';

interface InjectedTagInfo {
  id: string;
  tag: string;
  timestamp: number;
}

interface StyleChange {
  id: string;
  timestamp: number;
  property: keyof CSSStyleDeclaration;
  oldValue: string;
  newValue: string;
}

interface ShareCaptureProps {
  onClose: () => void;
  selectedElement: ElementInfo | null;
  imageDataUrl: string | null;
  captureUrl: string | null;
  injectedTags: InjectedTagInfo[];
  styleChanges: StyleChange[];
}

const formatTagChanges = (tags: InjectedTagInfo[]): string => {
  if (tags.length === 0) return 'No tags injected';

  return tags
    .map((tag) => {
      const date = new Date(tag.timestamp).toLocaleString();
      return `[${date}] Tag: ${tag.tag}`;
    })
    .join('\n');
};

const formatStyleChanges = (changes: StyleChange[]): string => {
  if (changes.length === 0) return 'No style changes';

  return changes
    .map((change) => {
      const date = new Date(change.timestamp).toLocaleString();
      return `[${date}] ${change.property}: ${change.oldValue} → ${change.newValue}`;
    })
    .join('\n');
};

const getShareFunction = (format: string) => {
  return format === 'pdf' ? shareAsPDF : shareAsPPT;
};

/**
 * Component to render a modal for sharing a screen capture
 * @param onClose - Function to close the modal
 * @param selectedElement - Information about the selected element
 * @param imageDataUrl - Data URL of the screen capture image
 * @param captureUrl - URL of the captured page
 * @param injectedTags - List of injected tags
 * @param styleChanges - List of style changes
 * @returns JSX.Element
 */
export const ShareCapture: React.FC<ShareCaptureProps> = ({
  onClose,
  selectedElement,
  imageDataUrl,
  captureUrl,
  injectedTags,
  styleChanges,
}) => {
  const { settings } = useSettings();
  const logger = new Logger('ShareCapture');

  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
        captureUrl || '',
        comment,
        selectedElement?.startTag || '',
        formatStyleChanges(styleChanges),
        formatTagChanges(injectedTags)
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

        <div className="changes-info">
          <div className="changes-section">
            <h3>Style Changes</h3>
            <pre>{formatStyleChanges(styleChanges)}</pre>
          </div>
          <div className="changes-section">
            <h3>Injected Tags</h3>
            <pre>{formatTagChanges(injectedTags)}</pre>
          </div>
        </div>
      </>
    );
  };

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