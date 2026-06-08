import type * as alphaTab from '@coderline/alphatab';

export interface DragDropOptions {
    onEnter?: () => void;
    onLeave?: () => void;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

export function loadScoreFile(api: alphaTab.AlphaTabApi, file: File): void {
    const reader = new FileReader();
    reader.onload = data => {
        if (data.target?.result) {
            api.load(data.target.result, [0]);
            try {
                if (typeof localStorage !== 'undefined') {
                    const base64 = arrayBufferToBase64(data.target.result as ArrayBuffer);
                    localStorage.setItem('at-playground-score-data', JSON.stringify({
                        name: file.name,
                        data: base64
                    }));
                }
            } catch (e) {
                console.error('Failed to save score to localStorage:', e);
            }
        }
    };
    reader.readAsArrayBuffer(file);
}

/**
 * Behaviour-only component: attaches document-level drag/drop handlers that
 * load a dropped file into the alphaTab API. Does not render any DOM of its own.
 */
export class DragDrop {
    private over = (e: DragEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'copy';
        }
        if (!this.dragging) {
            this.dragging = true;
            this.options.onEnter?.();
        }
    };
    private leave = (e: DragEvent) => {
        // The dragleave fires on every child element transition. Reset only when leaving the document.
        if (e.relatedTarget === null) {
            this.dragging = false;
            this.options.onLeave?.();
        }
    };
    private drop = (e: DragEvent) => {
        e.stopPropagation();
        e.preventDefault();
        this.dragging = false;
        this.options.onLeave?.();
        const files = e.dataTransfer?.files;
        if (files && files.length === 1) {
            loadScoreFile(this.api, files[0]);
        }
    };

    private dragging = false;

    constructor(
        private api: alphaTab.AlphaTabApi,
        private options: DragDropOptions = {}
    ) {
        document.addEventListener('dragover', this.over);
        document.addEventListener('dragleave', this.leave);
        document.addEventListener('drop', this.drop);
    }

    dispose(): void {
        document.removeEventListener('dragover', this.over);
        document.removeEventListener('dragleave', this.leave);
        document.removeEventListener('drop', this.drop);
    }
}
