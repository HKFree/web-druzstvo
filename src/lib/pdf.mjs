export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export function validPdf(bytes) {
  return bytes instanceof Uint8Array && bytes.byteLength <= MAX_PDF_BYTES
    && [37, 80, 68, 70, 45].every((value, index) => bytes[index] === value);
}
