import path from 'node:path';
import { EffectiveDirConfig, GlobalSidebarConfig, DirectoryConfig, GroupConfig, ExternalLinkConfig } from '../types';
// import { normalizePathSeparators } from '../shared/objectUtils'; // Not needed if path comes normalized

function convertItemOrderToRecord(itemOrder?: string[] | Record<string, number>): Record<string, number> {
    if (Array.isArray(itemOrder)) {
        const recordOrder: Record<string, number> = {};
        itemOrder.forEach((item, index) => {
            if (typeof item === 'string') recordOrder[item] = index;
        });
        return recordOrder;
    }
    if (typeof itemOrder === 'object' && itemOrder !== null) {
        // Convert order.json values to priority values
        const recordOrder: Record<string, number> = {};
        for (const [key, value] of Object.entries(itemOrder)) {
            // Ensure the value is a number
            const numValue = typeof value === 'number' ? value : parseInt(value as string, 10);
            if (!isNaN(numValue)) {
                recordOrder[key] = numValue;
            }
        }
        return recordOrder;
    }
    return {};
}

/**
 * Applies default values to a merged configuration 
 * to produce the final EffectiveDirConfig.
 * Uses hidden: boolean instead of status for visibility control.
 */
export function applyConfigDefaults(
    mergedConfig: Partial<EffectiveDirConfig>, // hidden here is boolean|undefined
    directoryPath: string, 
    lang: string, 
    isDevMode: boolean,
    globalDefaultsIn?: Partial<GlobalSidebarConfig['defaults']> | null
): EffectiveDirConfig {
    const dirName = path.basename(directoryPath);
    const actualGlobalDefaults = globalDefaultsIn || {};

    // Hidden is boolean - default to false (visible)
    const hidden: boolean = 
        mergedConfig.hidden ?? 
        actualGlobalDefaults.hidden ?? 
        false;

    const resolvedItemOrder = convertItemOrderToRecord(mergedConfig.itemOrder ?? actualGlobalDefaults.itemOrder);
    
    const defaultMaxDepth = actualGlobalDefaults.maxDepth ?? 2; 
    const maxDepth = mergedConfig.maxDepth ?? defaultMaxDepth;

    const scopeBasedDefaultCollapsed = true;
    const collapsed = mergedConfig.collapsed ?? actualGlobalDefaults.collapsed ?? scopeBasedDefaultCollapsed;

    // For title, only use mergedConfig.title if it was explicitly set. 
    // Don't fall back to inherited titles from parent directories.
    // Instead, generate a proper title from the directory name.
    const title = mergedConfig.title && mergedConfig.title !== 'Main Test Sidebar' // Avoid inherited title
        ? mergedConfig.title 
        : (dirName.charAt(0).toUpperCase() + dirName.slice(1).replace(/-/g, ' '));

    // If priority is not explicitly set, try to get it from itemOrder
    let priority = mergedConfig.priority;
    if (priority === undefined) {
        const dirKey = path.basename(directoryPath);
        if (resolvedItemOrder.hasOwnProperty(dirKey)) {
            priority = resolvedItemOrder[dirKey];
        } else {
            priority = Number.MAX_SAFE_INTEGER; // Default priority if not found in itemOrder
        }
    }

    // Constructing the object with all required fields of EffectiveDirConfig first,
    // then spreading the remaining/custom fields from mergedConfig.
    const baseConfig: Omit<EffectiveDirConfig, keyof Partial<DirectoryConfig>> & Required<Pick<EffectiveDirConfig, 'path' | 'lang' | 'isDevMode' | 'root' | 'title' | 'hidden' | 'priority' | 'maxDepth' | 'collapsed' | 'itemOrder' | 'groups' | 'externalLinks'>> = {
        path: directoryPath,
        lang,
        isDevMode,
        root: mergedConfig.root ?? false,
        title: title,
        hidden: hidden, 
        priority: priority,
        maxDepth: maxDepth, 
        collapsed: collapsed,
        itemOrder: resolvedItemOrder, 
        groups: mergedConfig.groups ?? [],
        externalLinks: mergedConfig.externalLinks ?? [],
    };

    // Add any other custom properties from mergedConfig that are not part of the core EffectiveDirConfig fields already set.
    const customFields: Partial<EffectiveDirConfig> = {};
    for (const key in mergedConfig) {
        if (mergedConfig.hasOwnProperty(key) && !(key in baseConfig)) {
            (customFields as any)[key] = mergedConfig[key as keyof EffectiveDirConfig];
        }
    }

    return { ...baseConfig, ...customFields } as EffectiveDirConfig;
} 

