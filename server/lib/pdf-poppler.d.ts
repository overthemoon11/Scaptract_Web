declare module 'pdf-poppler' {
  interface ConvertOptions {
    format?: string;
    out_dir?: string;
    out_prefix?: string;
    page?: number | null;
    first_page?: number;
    last_page?: number;
    scale?: number;
  }

  export function convert(pdfPath: string, options: ConvertOptions): Promise<string[]>;
}

