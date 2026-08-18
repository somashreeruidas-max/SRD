import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/**
 * Export report HTML as a PDF.
 * - Web: renders the HTML in a hidden iframe and opens the browser print dialog,
 *   which paginates the full report correctly (user selects "Save as PDF").
 * - Native: uses expo-print to generate a real multi-page PDF and shares it.
 */
export async function exportHtmlAsPdf(html: string, filename: string, dialogTitle: string): Promise<void> {
  if (Platform.OS === 'web') {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    if (!win) {
      document.body.removeChild(iframe);
      throw new Error('Unable to create print frame');
    }
    const doc = win.document;
    doc.open();
    doc.write(html);
    doc.close();
    doc.title = filename;

    // Wait for document + all images (base64 evidence photos) to finish loading
    await new Promise<void>((resolve) => {
      if (doc.readyState === 'complete') resolve();
      else iframe.onload = () => resolve();
      setTimeout(resolve, 3000); // safety net
    });
    const imgs = Array.from(doc.images);
    await Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((res) => {
              img.onload = () => res();
              img.onerror = () => res();
            })
      )
    );
    await new Promise((r) => setTimeout(r, 300));

    win.focus();
    win.print();
    // Clean up after the print dialog closes
    setTimeout(() => {
      if (iframe.parentNode) document.body.removeChild(iframe);
    }, 60000);
  } else {
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle,
      UTI: 'com.adobe.pdf',
    });
  }
}
