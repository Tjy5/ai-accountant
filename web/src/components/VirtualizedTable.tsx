import React, { useMemo, useCallback, useRef } from 'react';
import { Table, ConfigProvider } from 'antd';
import type { TableProps, TableColumnType } from 'antd';
import VirtualList from 'rc-virtual-list';
import { TABLE } from '../constants/ui';

interface VirtualizedTableProps<T> extends Omit<TableProps<T>, 'pagination'> {
  height?: number;
  itemHeight?: number;
  enableVirtualization?: boolean;
}

const VirtualizedTable = <T extends Record<string, any>>({
  height = TABLE.virtualHeight,
  itemHeight = TABLE.virtualItemHeight,
  enableVirtualization = true,
  dataSource = [],
  columns = [],
  ...props
}: VirtualizedTableProps<T>) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 虚拟滚动渲染函数
  const renderVirtualList = useCallback((rawData: readonly T[], { ref, onScroll }: any) => {
    return (
      <VirtualList
        ref={ref}
        height={height}
        itemHeight={itemHeight}
        data={Array.from(rawData)}
        itemKey="id"
        onScroll={onScroll}
      >
        {(item: T, index: number) => {
          const rowClassName = index % 2 === 0 ? 'virtual-row-even' : 'virtual-row-odd';
          
          return (
            <div 
              key={item.id || index}
              className={`virtual-table-row ${rowClassName}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 16px',
                borderBottom: '1px solid #f0f0f0',
                height: itemHeight,
                backgroundColor: index % 2 === 0 ? '#fafafa' : '#ffffff'
              }}
            >
              {columns.map((column: TableColumnType<T>, colIndex: number) => {
                const { dataIndex, render, width = 120, key } = column;
                let cellContent: React.ReactNode;
                
                if (render && typeof render === 'function') {
                  cellContent = render(item[dataIndex as string], item, index) as React.ReactNode;
                } else {
                  cellContent = item[dataIndex as string];
                }
                
                return (
                  <div
                    key={key || dataIndex as string || colIndex}
                    style={{
                      width: typeof width === 'number' ? width : 120,
                      minWidth: typeof width === 'number' ? width : 120,
                      padding: '0 8px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    {cellContent}
                  </div>
                );
              })}
            </div>
          );
        }}
      </VirtualList>
    );
  }, [columns, height, itemHeight]);

  // 表头渲染
  const renderHeader = useMemo(() => (
    <div 
      className="virtual-table-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: '#fafafa',
        borderBottom: '2px solid #f0f0f0',
        fontWeight: 600,
        position: 'sticky',
        top: 0,
        zIndex: 1
      }}
    >
      {columns.map((column: TableColumnType<T>, index: number) => {
        const { title, width = 120, key, dataIndex } = column;
        
        return (
          <div
            key={key || dataIndex as string || index}
            style={{
              width: typeof width === 'number' ? width : 120,
              minWidth: typeof width === 'number' ? width : 120,
              padding: '0 8px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            {typeof title === 'function' ? title({} as any) : title}
          </div>
        );
      })}
    </div>
  ), [columns]);

  // 决定是否使用虚拟化
  const shouldUseVirtualization = enableVirtualization && dataSource.length > 50;

  if (!shouldUseVirtualization) {
    // 数据量小时使用原生 Table 组件
    return (
      <Table
        {...props}
        dataSource={dataSource}
        columns={columns}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => 
            `显示 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
          pageSizeOptions: ['10', '20', '50', '100']
        }}
      />
    );
  }

  return (
    <ConfigProvider
      renderEmpty={() => (
        <div style={{ padding: '50px', textAlign: 'center', color: '#999' }}>
          暂无数据
        </div>
      )}
    >
      <div 
        ref={containerRef}
        className="virtualized-table-container"
        style={{
          border: '1px solid #f0f0f0',
          borderRadius: '6px',
          overflow: 'hidden'
        }}
      >
        {renderHeader}
        {dataSource.length > 0 ? (
          <Table
            {...props}
            dataSource={[]}
            columns={columns}
            showHeader={false}
            pagination={false}
            components={{
              body: () => renderVirtualList(dataSource, {}),
            }}
          />
        ) : (
          <div style={{ padding: '50px', textAlign: 'center', color: '#999' }}>
            暂无数据
          </div>
        )}
      </div>
    </ConfigProvider>
  );
};

export default VirtualizedTable;
