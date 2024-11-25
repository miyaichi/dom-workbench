import { Send, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useConnectionManager } from '../lib/connectionManager';
import { Logger } from '../lib/logger';
import { useSettings } from '../lib/settings';
import { shareAsPDF } from '../lib/shareAsPDF';
import { shareAsPPT } from '../lib/shareAsPPT';
import { ElementInfo, StyleModification } from '../types/domSelection';
import './ShareCapture.css';
import { formatElementTag } from './utils/htmlTagFormatter';

interface ShareCaptureProps {
  onClose: () => void;
  initialSelectedElement: ElementInfo | null;
  styleModifications: StyleModification[];
}

interface CaptureInfo {
  selectedElement: ElementInfo | null;
  captureUrl: string | null;
}

interface CaptureResultPayload {
  success: boolean;
  imageDataUrl?: string;
  error?: string;
  url?: string;
}

interface ElementSelectionMessage {
  payload: {
    elementInfo: ElementInfo;
  };
}

// Utility functions
const getShareFunction = (format: string) => {
  return format === 'pdf' ? shareAsPDF : shareAsPPT;
};

const initialCaptureInfo: CaptureInfo = {
  selectedElement: null,
  captureUrl: null,
};

const formatStyleModifications = (styleModifications: StyleModification[]) => {
  if (styleModifications.length === 0) return '';

  return styleModifications.map((mod) => `${mod.property}: ${mod.value}`).join('\n');
};

export const ShareCapture: React.FC<ShareCaptureProps> = ({
  onClose,
  initialSelectedElement,
  styleModifications,
}) => {
  // State declarations
  const { settings } = useSettings();
  const { subscribe } = useConnectionManager();
  const logger = new Logger('ShareCapture');

  const [comment, setComment] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string>();
  const [captureInfo, setCaptureInfo] = useState<CaptureInfo>({
    ...initialCaptureInfo,
    selectedElement: initialSelectedElement,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Event handlers
  const handleClose = (): void => {
    setImageDataUrl(undefined);
    setComment('');
    setCaptureInfo(initialCaptureInfo);
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
        captureInfo.captureUrl || '',
        captureInfo.selectedElement?.startTag || '',
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

  // Message subscriptions
  useEffect(() => {
    const subscriptions = [
      subscribe('CAPTURE_TAB_RESULT', (message: { payload: CaptureResultPayload }) => {
        const { success, imageDataUrl, error, url } = message.payload;

        if (success) {
          setImageDataUrl(imageDataUrl);
          setCaptureInfo((prev) => ({ ...prev, captureUrl: url || null }));
        } else {
          logger.error('Capture failed:', error);
        }
      }),

      subscribe('ELEMENT_SELECTED', (message: ElementSelectionMessage) => {
        setCaptureInfo((prev) => ({
          ...prev,
          selectedElement: message.payload.elementInfo,
        }));
      }),

      subscribe('ELEMENT_UNSELECTED', () => {
        setCaptureInfo((prev) => ({
          ...prev,
          selectedElement: null,
        }));
      }),
    ];

    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

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
        {captureInfo.captureUrl && (
          <div className="element-info">
            <p>{captureInfo.captureUrl}</p>
          </div>
        )}

        {captureInfo.selectedElement && (
          <div className="element-info">
            <p>[ {captureInfo.selectedElement.path.join(' > ')} ]</p>
            <p>
              {formatElementTag(captureInfo.selectedElement.startTag, {
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
