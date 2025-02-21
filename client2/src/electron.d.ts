// electron.d.ts
export {};

declare global {
  interface Window {
    electronAPI: {
      [key: string]: (...args: any[]) => any;  // позволяет добавлять любые функции с произвольным числом аргументов
    };
  }
}

