"use client";

import { useEffect, useRef, useCallback } from "react";
import { apiImageService } from "@/services/apiImageService";

interface MemoryManagerOptions {
  maxCachedImages?: number;
  cleanupInterval?: number; // milliseconds
  memoryThreshold?: number; // bytes
}

interface MemoryStats {
  cachedImages: number;
  activeUrls: number;
  memoryEstimate: number;
}

export const useMemoryManager = (
  visibleImageIds: string[],
  options: MemoryManagerOptions = {}
) => {
  const {
    maxCachedImages = 100,
    cleanupInterval = 30000, // 30 seconds
    memoryThreshold = 100 * 1024 * 1024 // 100MB
  } = options;

  const cleanupTimerRef = useRef<NodeJS.Timeout>();
  const lastVisibleIds = useRef<Set<string>>(new Set());

  // Clean up unused images
  const cleanup = useCallback(() => {
    const stats = apiImageService.getMemoryStats();
    
    // If we're over the threshold, be more aggressive
    const shouldCleanup = stats.cachedImages > maxCachedImages || 
                         stats.memoryEstimate > memoryThreshold;

    if (shouldCleanup) {
      console.log('[useMemoryManager] Memory cleanup triggered', stats);
      
      // Keep visible images plus some buffer for recently viewed
      const keepIds = new Set([
        ...visibleImageIds,
        ...Array.from(lastVisibleIds.current).slice(-20) // Keep last 20 viewed
      ]);

      apiImageService.cleanupImages(keepIds);
      
      // Log stats after cleanup
      const newStats = apiImageService.getMemoryStats();
      console.log('[useMemoryManager] Cleanup complete', newStats);
    }
  }, [visibleImageIds, maxCachedImages, memoryThreshold]);

  // Automatic cleanup on interval
  useEffect(() => {
    cleanupTimerRef.current = setInterval(cleanup, cleanupInterval);
    
    return () => {
      if (cleanupTimerRef.current) {
        clearInterval(cleanupTimerRef.current);
      }
    };
  }, [cleanup, cleanupInterval]);

  // Track visible images
  useEffect(() => {
    const currentVisible = new Set(visibleImageIds);
    
    // Add to recently viewed
    visibleImageIds.forEach(id => lastVisibleIds.current.add(id));
    
    // Limit size of recently viewed
    if (lastVisibleIds.current.size > 50) {
      const array = Array.from(lastVisibleIds.current);
      lastVisibleIds.current = new Set(array.slice(-50));
    }
  }, [visibleImageIds]);

  // Manual cleanup function
  const forceCleanup = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // Get current memory stats
  const getStats = useCallback((): MemoryStats => {
    return apiImageService.getMemoryStats();
  }, []);

  // Clean up all on unmount
  useEffect(() => {
    return () => {
      if (cleanupTimerRef.current) {
        clearInterval(cleanupTimerRef.current);
      }
      // Note: We don't cleanup all URLs on unmount as other components might still need them
    };
  }, []);

  return {
    forceCleanup,
    getStats
  };
};