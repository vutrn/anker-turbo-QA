declare var AnkerTurbo: any;
declare function importScripts(...urls: string[]): void;

interface typeofGlobalThis {
  AnkerTurbo: any;
}

interface Window {
  [key: string]: any;
  __ankerTurboTaskTitle?: {
    set(status: string, detail?: string): void;
  };
}

interface XMLHttpRequest {
  __ankerMethod?: string;
  __ankerUrl?: string | URL;
}
