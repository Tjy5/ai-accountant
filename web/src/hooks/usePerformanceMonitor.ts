import { useEffect, useRef, useState } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  itemCount: number;
  memoryUsage?: number;
  lastUpdate: number;
}

export const usePerformanceMonitor = (itemCount: number) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    itemCount: 0,
    lastUpdate: Date.now()
  });
  
  const renderStartTime = useRef<number>(0);
  const isFirstRender = useRef(true);

  // 开始性能监控
  const startMeasure = () => {
    renderStartTime.current = performance.now();
  };

  // 结束性能监控
  const endMeasure = () => {
    if (renderStartTime.current > 0) {
      const renderTime = performance.now() - renderStartTime.current;
      
      // 获取内存使用情况（如果浏览器支持）
      let memoryUsage;
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
      }

      setMetrics({
        renderTime: Math.round(renderTime * 100) / 100,
        itemCount,
        memoryUsage,
        lastUpdate: Date.now()
      });

      // 在开发环境下输出性能信息
      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 表格渲染性能:`, {
          renderTime: `${renderTime.toFixed(2)}ms`,
          itemCount: `${itemCount} 条记录`,
          memoryUsage: memoryUsage ? `${memoryUsage.toFixed(2)}MB` : '不可用'
        });
      }
    }
  };

  // 监控数据变化
  useEffect(() => {
    if (!isFirstRender.current) {
      startMeasure();
    } else {
      isFirstRender.current = false;
    }
  }, [itemCount]);

  return {
    metrics,
    startMeasure,
    endMeasure
  };
};
