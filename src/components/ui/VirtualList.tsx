"use client";

import type { ReactNode } from "react";
import { Virtuoso } from "react-virtuoso";

type VirtualListProps<T> = {
  className?: string;
  estimateItemHeight?: number;
  itemClassName?: string;
  itemKey?: (item: T, index: number) => string;
  items: T[];
  overscan?: number;
  renderItem: (item: T, index: number) => ReactNode;
  threshold?: number;
};

function virtualHeight(count: number, estimateItemHeight: number) {
  return Math.min(720, Math.max(240, count * estimateItemHeight));
}

export function VirtualList<T>({
  className,
  estimateItemHeight = 120,
  itemClassName,
  itemKey,
  items,
  overscan = 480,
  renderItem,
  threshold = 18
}: VirtualListProps<T>) {
  if (items.length <= threshold) {
    return (
      <div className={className}>
        {items.map((item, index) => (
          <div className={itemClassName} key={itemKey?.(item, index) ?? index}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <Virtuoso
      className={className}
      computeItemKey={(index, item) => itemKey?.(item, index) ?? index}
      data={items}
      increaseViewportBy={overscan}
      itemContent={(index, item) => (
        <div className={itemClassName}>
          {renderItem(item, index)}
        </div>
      )}
      style={{ height: virtualHeight(items.length, estimateItemHeight) }}
    />
  );
}
