/**
 * @description Shared LRU cache for media resources
 */
import { ResourceResolution } from "../types";

// LRU cache strategy: max 100 items to avoid unlimited memory growth
const MAX_CACHE_SIZE = 100;
const mediaResolutionCache = new Map<string, ResourceResolution>();
const cacheAccessOrder: string[] = []; // Track access order for LRU

/**
 * Add to cache and apply LRU strategy
 */
export function addToCache(key: string, value: ResourceResolution): void {
  // If exists, remove old access record first
  if (mediaResolutionCache.has(key)) {
    const index = cacheAccessOrder.indexOf(key);
    if (index > -1) {
      cacheAccessOrder.splice(index, 1);
    }
  }

  // Add new item
  mediaResolutionCache.set(key, value);
  cacheAccessOrder.push(key);

  // If exceeds max cache size, remove least recently used item
  if (mediaResolutionCache.size > MAX_CACHE_SIZE) {
    const oldestKey = cacheAccessOrder.shift();
    if (oldestKey) {
      mediaResolutionCache.delete(oldestKey);
    }
  }
}

/**
 * Get from cache and update access order
 */
export function getFromCache(key: string): ResourceResolution | undefined {
  const value = mediaResolutionCache.get(key);
  if (value) {
    // Update access order: move to end
    const index = cacheAccessOrder.indexOf(key);
    if (index > -1) {
      cacheAccessOrder.splice(index, 1);
      cacheAccessOrder.push(key);
    }
  }
  return value;
}

/**
 * Clear specific cache item or all cache
 * @param key - Cache key to clear. If not provided, clears all cache
 */
export function clearCache(key?: string): void {
  if (key) {
    mediaResolutionCache.delete(key);
    const index = cacheAccessOrder.indexOf(key);
    if (index > -1) {
      cacheAccessOrder.splice(index, 1);
    }
  } else {
    mediaResolutionCache.clear();
    cacheAccessOrder.length = 0;
  }
}

/**
 * Get current cache size
 */
export function getCacheSize(): number {
  return mediaResolutionCache.size;
}

/**
 * Check if a key exists in cache
 */
export function hasCache(key: string): boolean {
  return mediaResolutionCache.has(key);
}
