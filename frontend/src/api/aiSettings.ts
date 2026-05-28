import api from './axiosInstance';
import type { AiConnectionTest, AiSettings, AiSettingsUpdate } from '../types/ai';

export const getAiSettings = async () => {
  const { data } = await api.get<AiSettings>('/settings/ai');
  return data;
};

export const updateAiSettings = async (payload: AiSettingsUpdate) => {
  const { data } = await api.patch<AiSettings>('/settings/ai', payload);
  return data;
};

export const testAiSettings = async (payload: AiSettingsUpdate = {}) => {
  const { data } = await api.post<AiConnectionTest>('/settings/ai/test', payload);
  return data;
};
