declare module 'nodepub' {
  interface DocumentOptions {
    title: string;
    author: string;
    genre?: string;
    language?: string;
    publisher?: string;
    published?: Date;
    description?: string;
  }

  interface Document {
    addSection(title: string, content: string): void;
    writeEPUB(filePath: string, callback: (error?: Error) => void): void;
  }

  export function document(options: DocumentOptions): Document;
}
