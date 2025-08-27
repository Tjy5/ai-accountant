import React, { useState } from 'react';
import { Modal, Upload, Button, message, Progress, Alert, Space, Typography, Card } from 'antd';
import { UploadOutlined, FileExcelOutlined, FileTextOutlined, DownloadOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
// import config from './config';
import api from './utils/api';

const { Title, Text } = Typography;

interface ImportModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

interface ImportResult {
  success: boolean;
  message: string;
  total: number;
  inserted: number;
  errors?: Array<{
    row: number;
    error: string;
    data: any[];
  }>;
}

const ImportModal: React.FC<ImportModalProps> = ({ visible, onCancel, onSuccess }) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.error('请选择要导入的文件');
      return;
    }

    const formData = new FormData();
    formData.append('file', fileList[0].originFileObj as File);

    setUploading(true);
    setImportProgress(0);
    setImportResult(null);

    try {
      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setImportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await api.postForm<any>(`/api/transactions/import`, formData as any);

      clearInterval(progressInterval);
      setImportProgress(100);

      const result: ImportResult = response;
      setImportResult(result);

      if (result.success) {
        message.success(result.message);
        setTimeout(() => {
          onSuccess();
          handleReset();
        }, 2000);
      } else {
        message.error(result.message || '导入失败');
      }
    } catch (error) {
      console.error('导入失败:', error);
      message.error(error instanceof Error ? error.message : '导入失败');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFileList([]);
    setImportProgress(0);
    setImportResult(null);
  };

  const uploadProps: UploadProps = {
    onRemove: (file) => {
      const index = fileList.indexOf(file);
      const newFileList = fileList.slice();
      newFileList.splice(index, 1);
      setFileList(newFileList);
    },
    beforeUpload: (file) => {
      const isValidType = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                         file.type === 'application/vnd.ms-excel' ||
                         file.type === 'text/csv' ||
                         file.name.endsWith('.csv');
      
      if (!isValidType) {
        message.error('只支持 Excel (.xlsx, .xls) 和 CSV 文件');
        return false;
      }

      const isValidSize = file.size / 1024 / 1024 < 10;
      if (!isValidSize) {
        message.error('文件大小不能超过 10MB');
        return false;
      }

      setFileList([file]);
      return false; // 阻止自动上传
    },
    fileList,
    multiple: false,
  };

  const downloadTemplate = () => {
    // 创建示例数据
    const templateData = [
      ['类型', '金额', '分类', '描述', '日期', '标签'],
      ['支出', '25.50', '餐饮', '午餐', '2024-01-15', '外卖,工作日'],
      ['收入', '5000.00', '工资', '月薪', '2024-01-01', '公司'],
      ['支出', '120.00', '交通', '打车费', '2024-01-16', '出差;加班'],
    ];

    // 转换为CSV格式
    const csvContent = templateData.map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', '交易记录导入模板.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Modal
      title="批量导入交易记录"
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={600}
      destroyOnHidden
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 说明信息 */}
        <Card size="small">
          <Space direction="vertical" size="small">
            <Title level={5}>📋 导入说明</Title>
            <Text type="secondary">
              支持 Excel (.xlsx, .xls) 和 CSV 文件，文件大小不超过 10MB
            </Text>
            <Text type="secondary">
              必需字段：类型、金额、分类、描述、日期
            </Text>
            <Text type="secondary">
              类型支持：收入/income、支出/expense
            </Text>
          </Space>
        </Card>

        {/* 下载模板 */}
        <Card size="small">
          <Space direction="vertical" size="small">
            <Title level={5}>📥 下载模板</Title>
            <Button 
              type="dashed" 
              icon={<DownloadOutlined />}
              onClick={downloadTemplate}
            >
              下载 CSV 模板
            </Button>
          </Space>
        </Card>

        {/* 文件上传 */}
        <Card size="small">
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Title level={5}>📁 选择文件</Title>
            <Upload {...uploadProps} style={{ width: '100%' }}>
              <Button 
                icon={<UploadOutlined />} 
                style={{ width: '100%', height: 40 }}
                disabled={uploading}
              >
                选择文件
              </Button>
            </Upload>
          </Space>
        </Card>

        {/* 导入进度 */}
        {uploading && (
          <Card size="small">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Title level={5}>⏳ 导入进度</Title>
              <Progress percent={importProgress} status="active" />
            </Space>
          </Card>
        )}

        {/* 导入结果 */}
        {importResult && (
          <Card size="small">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Title level={5}>✅ 导入结果</Title>
              <Alert
                message={importResult.message}
                type={importResult.success ? 'success' : 'error'}
                showIcon
              />
              <Text>总计：{importResult.total} 条</Text>
              <Text>成功：{importResult.inserted} 条</Text>
              {importResult.errors && importResult.errors.length > 0 && (
                <Text type="danger">失败：{importResult.errors.length} 条</Text>
              )}
              
              {/* 错误详情 */}
              {importResult.errors && importResult.errors.length > 0 && (
                <div style={{ maxHeight: 200, overflow: 'auto' }}>
                  <Title level={5}>❌ 错误详情</Title>
                  {importResult.errors.map((error, index) => (
                    <Alert
                      key={index}
                      message={`第 ${error.row} 行：${error.error}`}
                      type="error"

                      style={{ marginBottom: 8 }}
                    />
                  ))}
                </div>
              )}
            </Space>
          </Card>
        )}

        {/* 操作按钮 */}
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onCancel} disabled={uploading}>
            取消
          </Button>
          <Button 
            type="primary" 
            onClick={handleUpload}
            loading={uploading}
            disabled={fileList.length === 0}
            icon={fileList[0]?.type?.includes('excel') ? <FileExcelOutlined /> : <FileTextOutlined />}
          >
            {uploading ? '导入中...' : '开始导入'}
          </Button>
        </Space>
      </Space>
    </Modal>
  );
};

export default ImportModal;
