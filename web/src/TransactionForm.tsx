import React, { useState, useRef } from 'react';
import { Form, Select, Input, InputNumber, Button, message, Space, Typography, DatePicker, Tag, Segmented } from 'antd';
import { AudioOutlined, PlusOutlined, PauseOutlined, PlayCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from './utils/api';
import CategorySelector from './components/CategorySelector';
import AIAnalysisPanel from './components/AIAnalysisPanel';
import type { DateLike } from '../../shared/types';

export type TransactionFormData = {
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description?: string;
  date?: DateLike;
  is_voice_input?: boolean; // 标识是否通过语音输入创建
  voice_input_text?: string; // 存储语音转文字的原始内容
  tags?: string[];
};

interface TransactionFormProps {
  onSubmit: (data: TransactionFormData) => Promise<void> | void;
  onCategoryChange?: () => void;
  onNavigateToCategoryManager?: () => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ onSubmit, onCategoryChange, onNavigateToCategoryManager }) => {
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [form] = Form.useForm<TransactionFormData>();
  const transactionType = Form.useWatch('type', form);
  const [aiSuggestedCategory, setAiSuggestedCategory] = useState<string | null>(null);
  const [voiceInputText, setVoiceInputText] = useState<string>(''); // 用于存储语音输入的文本
  const [isRecording, setIsRecording] = useState<boolean>(false); // 录音状态
  const [isPaused, setIsPaused] = useState<boolean>(false); // 暂停状态
  const recognitionRef = useRef<any>(null);
  const [allTags, setAllTags] = useState<string[]>([]);

  const handleFinish = async (values: TransactionFormData) => {
    try {
      // 优先使用AI提取的备注信息，如果没有则使用用户输入的备注，最后考虑语音输入文本
      const finalValues = {
        ...values,
        description: values.description || voiceInputText || '',
        is_voice_input: Boolean(voiceInputText && voiceInputText.trim().length > 0), // 如果有语音输入文本，则标记为语音输入
        voice_input_text: voiceInputText && voiceInputText.trim().length > 0 ? voiceInputText : undefined // 存储语音转文字的原始内容
      };

      const userFinalCategory = finalValues.category;
      const originalSuggested = aiSuggestedCategory;
      const keyword = (finalValues.description || '').trim();

      // 若用户修正了分类，且存在可用的 keyword，则将修正上报给后端
      if (
        originalSuggested &&
        userFinalCategory &&
        userFinalCategory !== originalSuggested &&
        keyword.length > 0
      ) {
        try {
          await api.post('/api/preferences', { keyword, category: userFinalCategory });
        } catch (_) {
          // 学习失败不影响正常提交流程
        }
      }

      await Promise.resolve(onSubmit(finalValues));
    } finally {
      // 提交结束后重置表单与建议状态
      form.resetFields();
      setAiSuggestedCategory(null);
      setVoiceInputText(''); // 重置语音输入文本
      setIsRecording(false); // 重置录音状态
      setIsPaused(false); // 重置暂停状态
    }
  };

  const handleVoiceRecognition = async (mode: 'overwrite' | 'append') => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      message.warning('当前浏览器不支持语音识别');
      return;
    }

    // 如果存在正在进行的识别，先强制停止
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsRecording(false);
      setIsPaused(false);
    }

    const msgKey = 'speech_recognition_key';
    message.loading({ content: '正在聆听...', key: msgKey, duration: 0 });
    setIsRecording(true);
    setIsPaused(false);

    const getSpeechText = (): Promise<string> => {
      return new Promise((resolve, reject) => {
        try {
          const recognition = new SpeechRecognition();
          recognitionRef.current = recognition;
          
          recognition.lang = 'zh-CN';
          recognition.interimResults = true;
          recognition.continuous = true; // 改为连续识别模式
          recognition.maxAlternatives = 1;

          let finalTranscript = '';
          let lastResultTime = Date.now();

          recognition.onresult = (event: any) => {
            if (!isPaused) { // 只有在非暂停状态下才处理结果
              for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                  finalTranscript += transcript;
                }
                // 无论是否是最终结果，都更新时间戳，防止自动超时
                lastResultTime = Date.now();
              }
            }
          };

          recognition.onerror = (event: any) => {
            recognitionRef.current = null;
            setIsRecording(false);
            setIsPaused(false);
            reject(new Error(event?.error || '语音识别出错'));
          };

          recognition.onend = () => {
            const text = finalTranscript.trim();
            recognitionRef.current = null;
            setIsRecording(false);
            setIsPaused(false);
            if (text) {
              resolve(text);
            } else {
              reject(new Error('未识别到有效语音'));
            }
          };

          // 启动识别后，设置一个定时器来检测是否应该结束识别
          recognition.start();
          
          // 每500ms检查一次是否应该结束识别
          const checkInterval = setInterval(() => {
            // 只有在未暂停且超过10秒没有新的识别结果时才结束识别
            if (!isPaused && Date.now() - lastResultTime > 10000) {
              clearInterval(checkInterval);
              if (recognitionRef.current) {
                recognitionRef.current.stop();
              }
            }
          }, 500);
        } catch (err) {
          recognitionRef.current = null;
          setIsRecording(false);
          setIsPaused(false);
          reject(new Error('无法启动语音识别，请重试'));
        }
      });
    };

    try {
      const rawText = await getSpeechText();
      
      // 根据模式处理文本：覆盖或追加到语音输入框
      let finalText = rawText;
      if (mode === 'append') {
        const existingVoiceText = voiceInputText || '';
        if (existingVoiceText.trim()) {
          finalText = `${existingVoiceText.trim()}, ${rawText}`;
        }
      }
      
      // 更新语音输入文本状态
      setVoiceInputText(finalText);
      
      message.loading({ content: '正在智能分析...', key: msgKey, duration: 0 });

      try {
        const data = await api.post<any>('/api/analyze-text', { text: finalText });
        
        // 处理多交易情况
        if (data.transactions && Array.isArray(data.transactions) && data.transactions.length > 0) {
          // 如果有多个交易，计算总金额和汇总描述
          const transactions = data.transactions;
          const totalAmount = transactions.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);
          
          // 生成汇总描述：包含所有物品和价格
          const summaryDescription = transactions
            .map((tx: any) => `${tx.description || '未知物品'}`)
            .join(', ');
          
          // 使用第一个交易的基本信息，但金额和描述使用汇总值
          const firstTransaction = transactions[0];
          const validCategory = firstTransaction && typeof firstTransaction.category === 'string' && firstTransaction.category.length > 0;
          const validAmount = totalAmount > 0;

          if (!validCategory || !validAmount) {
            throw new Error('返回数据格式不正确');
          }

          let parsedDayjs: dayjs.Dayjs | undefined;
          if (firstTransaction.date) {
            try {
              const jsDate = new Date(firstTransaction.date);
              if (!isNaN(jsDate.getTime())) {
                parsedDayjs = dayjs(jsDate);
              }
            } catch (_) {
              // ignore invalid date
            }
          }

          // 使用后端建议的主分类（如果存在），否则使用第一个交易的分类
          const finalCategory = data.primaryCategory || firstTransaction.category;

          form.setFieldsValue({
            category: finalCategory,
            amount: totalAmount,  // 使用总金额
            ...(parsedDayjs ? { date: parsedDayjs } : {}),
            description: summaryDescription  // 使用汇总描述
          });

          // 保存 AI 的首次分类建议以便学习对比
          setAiSuggestedCategory(finalCategory);
        } else {
          // 单个交易处理
          const validCategory = data && typeof data.category === 'string' && data.category.length > 0;
          const validAmount = data && typeof data.amount === 'number' && Number.isFinite(data.amount);

          if (!validCategory || !validAmount) {
            throw new Error('返回数据格式不正确');
          }

          let parsedDayjs: dayjs.Dayjs | undefined;
          if (data.date) {
            try {
              const jsDate = new Date(data.date);
              if (!isNaN(jsDate.getTime())) {
                parsedDayjs = dayjs(jsDate);
              }
            } catch (_) {
              // ignore invalid date
            }
          }

          form.setFieldsValue({
            category: data.category,
            amount: data.amount,
            ...(parsedDayjs ? { date: parsedDayjs } : {}),
            ...(data.description ? { description: data.description } : {})
          });

          // 保存 AI 的首次分类建议以便学习对比
          setAiSuggestedCategory(data.category);
        }

        message.success({ content: '智能填充完成！', key: msgKey });
      } catch (err) {
        message.error({ content: '智能分析失败，请手动输入', key: msgKey });
      }
    } catch (err: any) {
      setIsRecording(false);
      setIsPaused(false);
      message.error({ content: err?.message || '语音识别失败', key: msgKey });
    }
  };

  // 暂停/恢复语音识别
  const handlePauseResumeRecognition = () => {
    if (!recognitionRef.current) return;

    if (isPaused) {
      // 恢复识别
      setIsPaused(false);
      message.loading({ content: '继续聆听...', key: 'speech_recognition_key', duration: 0 });
    } else {
      // 暂停识别
      setIsPaused(true);
      message.loading({ content: '已暂停，点击恢复继续录音', key: 'speech_recognition_key', duration: 0 });
    }
  };

  // 手动停止识别
  const handleStopRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsRecording(false);
      setIsPaused(false);
      message.destroy('speech_recognition_key');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Segmented
          block
          value={mode}
          options={[
            { label: '普通录入', value: 'manual' },
            { label: 'AI 智能分析', value: 'ai' },
          ]}
          onChange={v => setMode(v as any)}
        />
      </div>

      {mode === 'ai' ? (
        <AIAnalysisPanel onSuccess={() => {
          setMode('manual');
          onCategoryChange?.();
        }} />
      ) : (
        <Form
          form={form}
          layout="vertical"
          initialValues={{ type: 'expense' }}
          onFinish={handleFinish}
        >
          <div style={{ marginBottom: 8 }}>
            <Typography.Text strong>填写交易信息</Typography.Text>
          </div>
      <Form.Item
        label="类型"
        name="type"
        rules={[{ required: true, message: '请选择类型' }]}
      >
        <Select
          options={[
            { label: '支出', value: 'expense' },
            { label: '收入', value: 'income' }
          ]}
        />
      </Form.Item>
      <Form.Item
        label="分类"
        name="category"
        rules={[{ required: true, message: '请选择分类' }]}
      >
        <CategorySelector 
          placeholder="请选择分类"
          showSearch={true}
          allowClear={true}
          type={transactionType || 'expense'}
          onCategoryChange={onCategoryChange}
          onNavigateToCategoryManager={onNavigateToCategoryManager}
        />
      </Form.Item>
      <Form.Item
        label="日期"
        name="date"
      >
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item
        label="金额"
        name="amount"
        rules={[
          { required: true, message: '请输入金额' },
          { type: 'number', min: 0, message: '金额不能为负数' }
        ]}
      >
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          step={0.01}
          precision={2}
          placeholder="请输入金额"
        />
      </Form.Item>
      <Form.Item
        label="备注"
        name="description"
      >
        <Input.TextArea placeholder="可选" rows={2} />
      </Form.Item>

      <Form.Item
        label="标签"
        name="tags"
      >
        <Select
          mode="tags"
          placeholder="输入并回车添加标签，可多选"
          style={{ width: '100%' }}
          tokenSeparators={[',', '，', ';', '；', ' ']}
          open={false}
          onChange={(values) => {
            const normalized = (values || []).map((v: string) => v.trim()).filter(Boolean);
            // 维护一个简单的历史集合（内存级）
            setAllTags(Array.from(new Set([...allTags, ...normalized])));
          }}
          tagRender={(props) => {
            const { label, closable, onClose } = props as any;
            return (
              <Tag closable={closable} onClose={onClose} color="#1890ff" style={{ marginRight: 4 }}>
                {label}
              </Tag>
            );
          }}
        />
      </Form.Item>
      <Form.Item
        label="语音输入"
      >
        <Input.TextArea 
          placeholder="点击下方按钮进行语音输入" 
          rows={2} 
          value={voiceInputText}
          onChange={(e) => setVoiceInputText(e.target.value)}
        />
        <div style={{ marginTop: 8 }}>
          <Space wrap size="small">
            <Button
              type="primary"
              icon={<AudioOutlined />}
              onClick={() => handleVoiceRecognition('overwrite')}
              disabled={isRecording}
              size="small"
            >
              语音填充
            </Button>
            <Button
              type="default"
              icon={<PlusOutlined />}
              onClick={() => handleVoiceRecognition('append')}
              disabled={isRecording}
              size="small"
            >
              继续补充
            </Button>
            {isRecording && (
              <>
                <Button
                  type={isPaused ? "primary" : "default"}
                  icon={isPaused ? <PlayCircleOutlined /> : <PauseOutlined />}
                  onClick={handlePauseResumeRecognition}
                  size="small"
                >
                  {isPaused ? '恢复' : '暂停'}
                </Button>
                <Button
                  type="dashed"
                  danger
                  onClick={handleStopRecognition}
                  size="small"
                >
                  停止
                </Button>
              </>
            )}
          </Space>
        </div>
      </Form.Item>
      <Button type="primary" htmlType="submit" block>
        提交
      </Button>
    </Form>
      )}
    </div>
  );
};

export default TransactionForm;


