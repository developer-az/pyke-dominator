export { };

declare global {
    interface Window {
        electronAPI?: {
            connectLCU: () => Promise<{ success: boolean; credentials?: { port: string; token: string; protocol: string }; error?: string }>;
            requestLCU: (method: string, endpoint: string, body?: unknown) => Promise<{ success: boolean; data?: unknown; error?: string }>;
            exportItemSet: (build: { starter: Array<{ id: string }>; core: Array<{ id: string }>; boots: { id: string }; situational: Array<{ id: string }>; buildPath: Array<{ id: string }> }) => Promise<{ success: boolean; error?: string }>;
            onUpdate: (callback: (value: unknown) => void) => void;
            windowMinimize: () => Promise<void>;
            windowMaximize: () => Promise<void>;
            windowClose: () => Promise<void>;
        };
    }
}
