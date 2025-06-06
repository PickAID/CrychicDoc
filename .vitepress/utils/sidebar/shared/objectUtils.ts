export function deepMerge<T extends object>(target: T, ...sources: Partial<T>[]): T {
    // Placeholder for actual deep merge logic
    if (sources.length > 0 && sources[0]) {
        Object.assign(target, sources[0]); // Very basic merge for placeholder
    }
    return target;
}

export function normalizePathSeparators(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}

/**
 * Sanitizes a string (typically a title) to be file-system path friendly.
 * Converts to lowercase, replaces spaces and unsafe characters with hyphens,
 * consolidates multiple hyphens, and removes leading/trailing hyphens.
 * @param title The string to sanitize.
 * @returns A sanitized string suitable for use in paths.
 */
export function sanitizeTitleForPath(title: string): string {
    if (!title) return 'untitled';

    let sanitized = title.toLowerCase();
    // Replace spaces and common problematic characters with a hyphen
    sanitized = sanitized.replace(/[\s/?<>\\:\*\|"\^]/g, '-');
    // Replace multiple hyphens with a single hyphen
    sanitized = sanitized.replace(/-+/g, '-');
    // Remove leading and trailing hyphens
    sanitized = sanitized.replace(/^-+|-+$/g, '');
    // If the sanitization results in an empty string (e.g., title was just "-"), default to "untitled"
    if (!sanitized) return 'untitled';
    
    return sanitized;
} 

/**
 * Performs a deep comparison of two objects.
 * @param obj1 The first object.
 * @param obj2 The second object.
 * @returns True if the objects are deeply equal, false otherwise.
 */
export function isDeepEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;

    if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
        return false;
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
        if (!keys2.includes(key) || !isDeepEqual(obj1[key], obj2[key])) {
            return false;
        }
    }

    return true;
}

