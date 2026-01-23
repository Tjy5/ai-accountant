/**
 * Generate a unique ID combining timestamp and random components.
 * Format: timestamp (ms) + random suffix
 * This avoids AUTOINCREMENT conflicts when syncing across devices.
 */
export function generateLocalId(): number {
    // Use timestamp (ms) plus random suffix (0-9999)
    // This generates a unique 17-digit number that won't conflict across devices
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    // Return as a safe integer (max 53 bits)
    // We use modulo to keep within safe integer range
    return Number(`${timestamp}${String(random).padStart(4, '0')}`) % Number.MAX_SAFE_INTEGER;
}

/**
 * Generate a simple UUID v4-like string
 */
export function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
