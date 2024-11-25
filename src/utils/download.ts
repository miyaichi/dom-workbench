// src/utils/download.ts

/**
 * Downloads a file using the Chrome downloads API
 * @param blob - The file data as a Blob
 * @param filename - The name of the file to be saved
 * @param options - Optional settings for the download
 * @param options.saveAs - Whether to show the save as dialog (default is false)
 * @returns A promise that resolves when the download is initiated
 */
export const downloadFile = async (
  blob: Blob,
  filename: string,
  options: { saveAs?: boolean } = {}
): Promise<void> => {
  const downloadUrl = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({
      url: downloadUrl,
      filename,
      saveAs: options.saveAs ?? false, // Save as dialog by default
    });
  } finally {
    // Cleanup immediately after download starts
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  }
};
