/** Native photo capture works on a local HTTP link where live video is unavailable. */
export async function scanQrPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const { BrowserQRCodeReader } = await import('@zxing/browser')
    const result = await new BrowserQRCodeReader().decodeFromImageUrl(url)
    return result.getText()
  } finally {
    URL.revokeObjectURL(url)
  }
}
