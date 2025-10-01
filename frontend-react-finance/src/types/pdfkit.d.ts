declare module "pdfkit" {
  export interface PDFDocumentOptions {
    size?: string | [number, number];
    margin?: number;
    layout?: "portrait" | "landscape";
    info?: Record<string, string | number | boolean | undefined>;
  }
  class PDFDocument {
    constructor(options?: PDFDocumentOptions);
    pipe(dest: NodeJS.WritableStream): NodeJS.WritableStream;
    text(t: string, x?: number, y?: number, opts?: Record<string, unknown>): this;
    image(src: string | Buffer, x?: number, y?: number, opts?: Record<string, unknown>): this;
    font(src: string | Buffer): this;
    fontSize(n: number): this;
    moveDown(lines?: number): this;
    addPage(opts?: PDFDocumentOptions): this;
    end(): void;
    page: { width: number; margins: { left: number; right: number } };
  }
  export default PDFDocument;
}
