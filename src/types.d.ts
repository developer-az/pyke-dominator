export { };

declare global {
    interface Window {
        electronAPI?: {
            connectLCU: () => Promise<{ success: boolean; credentials?: any; error?: string }>;
            requestLCU: (method: string, endpoint: string, body?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
            onUpdate: (callback: (value: any) => void) => void;
        };
    }
}
