"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FixedSizeGrid as Grid } from "react-window";
import InfiniteLoader from "react-window-infinite-loader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CheckCircle2, 
  Clock, 
  Circle, 
  Eye, 
  Trash2, 
  AlertCircle,
  Search 
} from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { useRoles } from "@/auth/useRoles";
import { ImageFile } from "@/features/file/hooks/useFileManager";

interface VirtualizedImageGridProps {
  images: ImageFile[];
  totalCount: number;
  isLoading: boolean;
  hasNextPage: boolean;
  loadMore: () => Promise<void>;
  onImageClick?: (image: ImageFile) => void;
  onDeleteImage?: (imageId: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

interface GridItemData {
  images: ImageFile[];
  columnCount: number;
  itemWidth: number;
  itemHeight: number;
  onImageClick?: (image: ImageFile) => void;
  onDeleteImage?: (imageId: string) => void;
  canDeleteImages: boolean;
}

interface GridItemProps {
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
  data: GridItemData;
}

const GridItem: React.FC<GridItemProps> = ({ 
  columnIndex, 
  rowIndex, 
  style, 
  data 
}) => {
  const { 
    images, 
    columnCount, 
    onImageClick, 
    onDeleteImage, 
    canDeleteImages 
  } = data;
  
  const index = rowIndex * columnCount + columnIndex;
  const image = images[index];

  if (!image) {
    return (
      <div style={style} className="p-2">
        <div className="w-full h-full bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'in-progress':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div style={style} className="p-2">
      <Card className="group relative h-full cursor-pointer hover:shadow-md transition-shadow">
        <CardContent className="p-0 h-full flex flex-col">
          {/* Image thumbnail */}
          <div className="relative flex-1 min-h-0">
            <img
              src={image.url}
              alt={image.name}
              className="w-full h-full object-cover rounded-t-lg"
              loading="lazy"
              onClick={() => onImageClick?.(image)}
            />
            
            {/* Status indicator */}
            <div className="absolute top-2 right-2">
              {getStatusIcon(image.status)}
            </div>

            {/* Delete button - only visible on hover and if user can delete */}
            {canDeleteImages && onDeleteImage && (
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteImage(image.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}

            {/* View button */}
            <Button
              variant="secondary"
              size="sm"
              className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onImageClick?.(image);
              }}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>

          {/* Image info */}
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium truncate" title={image.name}>
                {image.name}
              </h3>
              <Badge 
                variant="secondary" 
                className={`text-xs ${getStatusColor(image.status)}`}
              >
                {image.status}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{formatBytes(image.size)}</span>
              <span>{image.annotations} annotations</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const LoadingItem: React.FC<{ style: React.CSSProperties }> = ({ style }) => (
  <div style={style} className="p-2">
    <Card className="h-full">
      <CardContent className="p-0 h-full flex flex-col">
        <Skeleton className="flex-1 rounded-t-lg" />
        <div className="p-3 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);

export const VirtualizedImageGrid: React.FC<VirtualizedImageGridProps> = ({
  images,
  totalCount,
  isLoading,
  hasNextPage,
  loadMore,
  onImageClick,
  onDeleteImage,
  searchQuery = "",
  onSearchChange
}) => {
  const { canDeleteImages } = useRoles();
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [searchInput, setSearchInput] = useState(searchQuery);

  // Grid layout calculations
  const ITEM_WIDTH = 280;
  const ITEM_HEIGHT = 320;
  const GAP = 16;

  const columnCount = Math.max(1, Math.floor((containerSize.width - GAP) / (ITEM_WIDTH + GAP)));
  const rowCount = Math.ceil(images.length / columnCount);
  const totalRowCount = hasNextPage ? rowCount + 1 : rowCount;

  // Filter images based on search query
  const filteredImages = useMemo(() => {
    if (!searchQuery.trim()) return images;
    
    return images.filter(image => 
      image.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      image.status.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [images, searchQuery]);

  // Handle container resize
  const handleResize = useCallback((entries: ResizeObserverEntry[]) => {
    if (entries[0]) {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    }
  }, []);

  useEffect(() => {
    const container = document.getElementById('image-grid-container');
    if (!container) return;

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Initial size
    const rect = container.getBoundingClientRect();
    setContainerSize({ width: rect.width, height: rect.height });

    return () => {
      resizeObserver.disconnect();
    };
  }, [handleResize]);

  // Check if item is loaded
  const isItemLoaded = useCallback((index: number) => {
    return index < filteredImages.length;
  }, [filteredImages.length]);

  // Load more items
  const loadMoreItems = useCallback(async () => {
    if (!isLoading && hasNextPage) {
      await loadMore();
    }
  }, [isLoading, hasNextPage, loadMore]);

  // Grid item data
  const itemData: GridItemData = useMemo(() => ({
    images: filteredImages,
    columnCount,
    itemWidth: ITEM_WIDTH,
    itemHeight: ITEM_HEIGHT,
    onImageClick,
    onDeleteImage,
    canDeleteImages
  }), [filteredImages, columnCount, onImageClick, onDeleteImage, canDeleteImages]);

  // Handle search
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange?.(searchInput);
  };

  if (containerSize.width === 0) {
    return (
      <div id="image-grid-container" className="flex-1 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <LoadingItem key={i} style={{}} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div id="image-grid-container" className="flex-1 w-full flex flex-col">
      {/* Search bar */}
      {onSearchChange && (
        <div className="p-4 border-b">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search images by name or status..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>
        </div>
      )}

      {/* Stats */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Showing {filteredImages.length} of {totalCount} images
            {searchQuery && ` (filtered by "${searchQuery}")`}
          </span>
          {isLoading && <span>Loading...</span>}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1">
        {filteredImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <AlertCircle className="h-12 w-12 mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? "No images found" : "No images in this project"}
            </h3>
            <p>
              {searchQuery 
                ? "Try adjusting your search query" 
                : "Upload some images to get started"
              }
            </p>
          </div>
        ) : (
          <InfiniteLoader
            isItemLoaded={isItemLoaded}
            itemCount={totalRowCount * columnCount}
            loadMoreItems={loadMoreItems}
          >
            {({ onItemsRendered, ref }) => (
              <Grid
                ref={ref}
                columnCount={columnCount}
                columnWidth={ITEM_WIDTH + GAP}
                height={containerSize.height - 120} // Account for search bar and stats
                rowCount={totalRowCount}
                rowHeight={ITEM_HEIGHT + GAP}
                width={containerSize.width}
                itemData={itemData}
                onItemsRendered={({
                  visibleRowStartIndex,
                  visibleRowStopIndex,
                  visibleColumnStartIndex,
                  visibleColumnStopIndex,
                }) => {
                  onItemsRendered({
                    visibleStartIndex: visibleRowStartIndex * columnCount + visibleColumnStartIndex,
                    visibleStopIndex: visibleRowStopIndex * columnCount + visibleColumnStopIndex,
                  });
                }}
              >
                {GridItem}
              </Grid>
            )}
          </InfiniteLoader>
        )}
      </div>
    </div>
  );
};

export default VirtualizedImageGrid;