// src/utils/formatters.ts

/**
 * Format a timestamp to a string in the format "YYYY/MM/DD HH:MM:SS"
 * @param date - The date object to format
 * @returns The formatted timestamp string
 */
export const formatTimestamp = (date: Date): string => {
  return date
    .toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    .replace(/\//g, '/')
    .replace(/,/g, '');
};

/**
 * Generate a filename based on the timestamp
 * @param date - The date object to base the filename on
 * @param extension - The file extension (either 'pdf' or 'pptx')
 * @returns The generated filename string
 */
export const generateFilename = (date: Date, extension: 'pdf' | 'pptx'): string => {
  return `capture_${date
    .toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    .replace(/\//g, '/')
    .replace(/[\/\s:]/g, '_')}.${extension}`;
};
