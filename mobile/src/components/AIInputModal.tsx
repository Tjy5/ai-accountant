import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
    Modal,
    ScrollView,
    View,
    TextInput,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    Animated,
    Image,
    Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useAuth } from '../auth/AuthContext';
import { createLocalTransactions } from '../storage/localDB';
import { enqueueMany } from '../sync/offlineQueue';
import { theme } from '../theme';
import { AppText } from './AppText';
import { api, getApiErrorMessage } from '../../../shared/utils/api';
import type { AIAnalysisResult, AITransactionDraft } from '../../../shared/types';

export type AIInputMode = 'text' | 'voice' | 'voice-text' | 'camera' | null;

interface AIInputModalProps {
    visible: boolean;
    mode: AIInputMode;
    onClose: () => void;
    onResult: (draft: AITransactionDraft) => void;
}

export function AIInputModal({ visible, mode, onClose, onResult }: AIInputModalProps) {
    const { user } = useAuth();
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<AITransactionDraft[]>([]);
    const [ignored, setIgnored] = useState<string[]>([]);
    const [warnings, setWarnings] = useState<string[]>([]);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    const totalAmount = useMemo(() => {
        return drafts.reduce((sum, d) => sum + (Number.isFinite(Number(d.amount)) ? Number(d.amount) : 0), 0);
    }, [drafts]);

    // Reset state when modal closes
    useEffect(() => {
        if (!visible) {
            setText('');
            setImageUri(null);
            setIsRecording(false);
            setRecording(null);
            setDrafts([]);
            setIgnored([]);
            setWarnings([]);
            setLoading(false);
            setSaving(false);
        }
    }, [visible]);

    const setBatchResult = (res: AIAnalysisResult, emptyFallbackMessage: string) => {
        const txs = Array.isArray(res?.transactions) ? res.transactions : [];
        const normalized = txs.filter(Boolean);

        if (normalized.length >= 2) {
            setDrafts(normalized);
            setIgnored(Array.isArray(res?.ignored) ? res.ignored : []);
            setWarnings(Array.isArray(res?.warnings) ? res.warnings : []);
            return;
        }

        if (normalized.length === 1) {
            onResult(normalized[0]);
            onClose();
            return;
        }

        Alert.alert(
            '未识别到交易',
            (Array.isArray(res?.warnings) ? res.warnings.join('\n') : '') || emptyFallbackMessage
        );
    };

    const updateDraft = (idx: number, patch: Partial<AITransactionDraft>) => {
        setDrafts(prev => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
    };

    const removeDraft = (idx: number) => {
        setDrafts(prev => {
            const next = prev.filter((_, i) => i !== idx);
            if (next.length === 0) {
                setIgnored([]);
                setWarnings([]);
            }
            return next;
        });
    };

    const clearBatchResult = () => {
        setDrafts([]);
        setIgnored([]);
        setWarnings([]);
    };

    const saveAllDrafts = async () => {
        if (!user) {
            Alert.alert('未登录', '请先登录');
            return;
        }
        if (drafts.length === 0) return;

        const items = drafts.map(d => ({
            type: d.type,
            category: String(d.category || '').trim(),
            amount: Number(d.amount),
            description: String(d.description || '').trim(),
            date: String(d.date || '').trim(),
        }));

        const invalid = items.find(it => !it.category || !Number.isFinite(it.amount) || it.amount <= 0);
        if (invalid) {
            Alert.alert('提示', '请检查分类与金额（金额必须为正数）');
            return;
        }

        setSaving(true);
        try {
            const created = await createLocalTransactions(user.id, items);
            await enqueueMany(user.id, 'transactions', 'upsert', created);
            Alert.alert('已保存', `已保存到本地（待同步）：${created.length} 条，合计 ${totalAmount.toFixed(2)}`);
            clearBatchResult();
            onClose();
        } catch (err: unknown) {
            Alert.alert('保存失败', getApiErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    // Pulse animation for recording
    useEffect(() => {
        if (isRecording) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isRecording, pulseAnim]);

    // ========== Text Analysis ==========
    const analyzeText = async (inputText: string) => {
        if (!inputText.trim()) {
            Alert.alert('提示', '请输入要分析的内容');
            return;
        }

        setLoading(true);
        try {
            const res = await api.post<AIAnalysisResult>('/api/ai/analyze', { text: inputText });
            setBatchResult(res, '请尝试更明确的描述');
        } catch (err: unknown) {
            Alert.alert('分析失败', getApiErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    // ========== Voice Recording ==========
    const startRecording = async () => {
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('权限错误', '需要麦克风权限才能录音');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            setRecording(newRecording);
            setIsRecording(true);
        } catch (err) {
            console.error('Failed to start recording', err);
            Alert.alert('录音失败', '无法启动录音');
        }
    };

    const stopRecording = async () => {
        if (!recording) return;

        setIsRecording(false);
        setLoading(true);

        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecording(null);

            if (uri) {
                // Read audio file and send to transcription API
                const base64Audio = await FileSystem.readAsStringAsync(uri, {
                    encoding: 'base64',
                });

                // Send to backend for transcription
                const transcribeRes = await api.post<{ text: string }>('/api/ai/transcribe', {
                    audio: base64Audio,
                    format: 'm4a',
                });

                if (transcribeRes.text) {
                    // Now analyze the transcribed text
                    await analyzeText(transcribeRes.text);
                } else {
                    Alert.alert('识别失败', '未能识别语音内容');
                }
            }
        } catch (err: unknown) {
            Alert.alert('处理失败', getApiErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    // ========== Camera / Image Picker ==========
    const pickImage = async (useCamera: boolean) => {
        try {
            const permission = useCamera
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (!permission.granted) {
                Alert.alert('权限错误', useCamera ? '需要相机权限' : '需要相册权限');
                return;
            }

            const result = useCamera
                ? await ImagePicker.launchCameraAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    quality: 0.8,
                    base64: false,
                })
                : await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    quality: 0.8,
                    base64: false,
                });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setImageUri(result.assets[0].uri);
            }
        } catch (err) {
            console.error('Image picker error', err);
            Alert.alert('选择图片失败', String(err));
        }
    };

    const analyzeImage = async () => {
        if (!imageUri) return;

        setLoading(true);
        try {
            const base64Image = await FileSystem.readAsStringAsync(imageUri, {
                encoding: 'base64',
            });

            const res = await api.post<AIAnalysisResult>('/api/ai/analyze-image', {
                image: base64Image,
            });

            setBatchResult(res, '请尝试拍摄更清晰的票据/收据');
        } catch (err: unknown) {
            Alert.alert('识别失败', getApiErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    // ========== Render Content Based on Mode ==========
    const renderContent = () => {
        if (drafts.length > 0) {
            return (
                <View style={[styles.content, { flex: 1 }]}>
                    <View style={styles.headerRow}>
                        <AppText variant="title" bold>🤖 识别结果</AppText>
                        <Pressable onPress={onClose} hitSlop={10} disabled={saving}>
                            <MaterialCommunityIcons name="close" size={22} color={theme.colors.textSecondary} />
                        </Pressable>
                    </View>

                    <AppText variant="caption" color={theme.colors.textSecondary} style={{ marginBottom: 10 }}>
                        共 {drafts.length} 条，合计 ¥{totalAmount.toFixed(2)}
                    </AppText>

                    {warnings.length > 0 && (
                        <View style={styles.bannerWarn}>
                            <AppText bold color="#856404" style={{ marginBottom: 6 }}>AI 提示</AppText>
                            {warnings.map((w, i) => (
                                <AppText key={i} variant="caption" color="#856404" style={{ marginBottom: 2 }}>• {w}</AppText>
                            ))}
                        </View>
                    )}

                    {ignored.length > 0 && (
                        <View style={styles.bannerInfo}>
                            <AppText bold color="#0C5460" style={{ marginBottom: 6 }}>已忽略内容</AppText>
                            {ignored.map((s, i) => (
                                <AppText key={i} variant="caption" color="#0C5460" style={{ marginBottom: 2 }}>• {s}</AppText>
                            ))}
                        </View>
                    )}

                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingBottom: 16 }}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {drafts.map((d, idx) => (
                            <View key={idx} style={styles.draftCard}>
                                <View style={styles.draftHeader}>
                                    <AppText bold>交易 {idx + 1}</AppText>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                        <Pressable
                                            style={[styles.smallPrimaryBtn, saving && { opacity: 0.6 }]}
                                            onPress={() => {
                                                onResult(d);
                                                onClose();
                                            }}
                                            disabled={saving}
                                        >
                                            <AppText color="#fff" variant="caption" bold>填充</AppText>
                                        </Pressable>
                                        <Pressable onPress={() => removeDraft(idx)} hitSlop={10} disabled={saving}>
                                            <MaterialCommunityIcons name="close-circle-outline" size={20} color={theme.colors.error} />
                                        </Pressable>
                                    </View>
                                </View>

                                <View style={styles.typeSelector}>
                                    <Pressable
                                        style={[styles.typeBtn, d.type === 'expense' && styles.typeBtnActive]}
                                        onPress={() => updateDraft(idx, { type: 'expense' })}
                                        disabled={saving}
                                    >
                                        <AppText color={d.type === 'expense' ? '#fff' : theme.colors.textSecondary} variant="caption" bold>
                                            支出
                                        </AppText>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.typeBtn, d.type === 'income' && styles.typeBtnActive]}
                                        onPress={() => updateDraft(idx, { type: 'income' })}
                                        disabled={saving}
                                    >
                                        <AppText color={d.type === 'income' ? '#fff' : theme.colors.textSecondary} variant="caption" bold>
                                            收入
                                        </AppText>
                                    </Pressable>
                                </View>

                                <View style={styles.inputRow}>
                                    <View style={{ flex: 1 }}>
                                        <AppText variant="caption" color={theme.colors.textSecondary}>分类</AppText>
                                        <TextInput
                                            style={styles.input}
                                            value={String(d.category ?? '')}
                                            onChangeText={(v) => updateDraft(idx, { category: v })}
                                            placeholder="分类"
                                            placeholderTextColor={theme.colors.textSecondary + '80'}
                                            editable={!saving}
                                        />
                                    </View>
                                    <View style={{ width: 12 }} />
                                    <View style={{ flex: 1 }}>
                                        <AppText variant="caption" color={theme.colors.textSecondary}>金额</AppText>
                                        <TextInput
                                            style={styles.input}
                                            value={Number.isFinite(Number(d.amount)) ? String(d.amount) : ''}
                                            onChangeText={(v) => updateDraft(idx, { amount: Number(v) })}
                                            placeholder="0.00"
                                            placeholderTextColor={theme.colors.textSecondary + '80'}
                                            keyboardType="decimal-pad"
                                            editable={!saving}
                                        />
                                    </View>
                                </View>

                                <View style={styles.inputRow}>
                                    <View style={{ flex: 1 }}>
                                        <AppText variant="caption" color={theme.colors.textSecondary}>日期</AppText>
                                        <TextInput
                                            style={styles.input}
                                            value={String(d.date ?? '')}
                                            onChangeText={(v) => updateDraft(idx, { date: v })}
                                            placeholder="YYYY-MM-DD"
                                            placeholderTextColor={theme.colors.textSecondary + '80'}
                                            editable={!saving}
                                        />
                                    </View>
                                </View>

                                <View style={{ marginTop: 8 }}>
                                    <AppText variant="caption" color={theme.colors.textSecondary}>备注</AppText>
                                    <TextInput
                                        style={[styles.input, styles.multilineInput]}
                                        value={String(d.description ?? '')}
                                        onChangeText={(v) => updateDraft(idx, { description: v })}
                                        placeholder="备注..."
                                        placeholderTextColor={theme.colors.textSecondary + '80'}
                                        multiline
                                        editable={!saving}
                                    />
                                </View>
                            </View>
                        ))}
                    </ScrollView>

                    <View style={[styles.buttonRow, { justifyContent: 'space-between' }]}>
                        <Pressable style={styles.cancelButton} onPress={clearBatchResult} disabled={saving}>
                            <AppText color={theme.colors.textSecondary}>返回</AppText>
                        </Pressable>
                        <Pressable
                            style={[styles.primaryButton, saving && { opacity: 0.6 }]}
                            onPress={saveAllDrafts}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons name="content-save-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                                    <AppText color="#fff" bold>全部保存</AppText>
                                </>
                            )}
                        </Pressable>
                    </View>
                </View>
            );
        }

        if (mode === 'text') {
            return (
                <View style={styles.content}>
                    <AppText variant="title" bold centered style={{ marginBottom: 16 }}>
                        📝 文字智能记账
                    </AppText>
                    <AppText variant="caption" color={theme.colors.textSecondary} centered style={{ marginBottom: 20 }}>
                        描述您的支出或收入，AI 将自动识别
                    </AppText>

                    <TextInput
                        style={styles.textArea}
                        value={text}
                        onChangeText={setText}
                        placeholder="例如：今天午饭花了 35 元，打车 20 块"
                        placeholderTextColor={theme.colors.textSecondary + '80'}
                        multiline
                        autoFocus
                    />

                    <View style={styles.buttonRow}>
                        <Pressable style={styles.cancelButton} onPress={onClose}>
                            <AppText color={theme.colors.textSecondary}>取消</AppText>
                        </Pressable>
                        <Pressable
                            style={[styles.primaryButton, loading && { opacity: 0.6 }]}
                            onPress={() => analyzeText(text)}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons name="robot" size={18} color="#fff" style={{ marginRight: 6 }} />
                                    <AppText color="#fff" bold>AI 分析</AppText>
                                </>
                            )}
                        </Pressable>
                    </View>
                </View>
            );
        }

        if (mode === 'voice') {
            return (
                <View style={styles.content}>
                    <AppText variant="title" bold centered style={{ marginBottom: 16 }}>
                        🎤 语音记账
                    </AppText>
                    <AppText variant="caption" color={theme.colors.textSecondary} centered style={{ marginBottom: 30 }}>
                        {isRecording ? '正在录音，再次点击停止' : '点击麦克风开始录音'}
                    </AppText>

                    <Animated.View style={[styles.micContainer, { transform: [{ scale: pulseAnim }] }]}>
                        <Pressable
                            style={[styles.micButton, isRecording && styles.micButtonRecording]}
                            onPress={isRecording ? stopRecording : startRecording}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" size="large" />
                            ) : (
                                <MaterialCommunityIcons
                                    name={isRecording ? 'stop' : 'microphone'}
                                    size={48}
                                    color="#fff"
                                />
                            )}
                        </Pressable>
                    </Animated.View>

                    {isRecording && (
                        <AppText centered color={theme.colors.error} style={{ marginTop: 20 }}>
                            ● 录音中...
                        </AppText>
                    )}

                    <Pressable style={[styles.cancelButton, { marginTop: 30, alignSelf: 'center' }]} onPress={onClose}>
                        <AppText color={theme.colors.textSecondary}>取消</AppText>
                    </Pressable>
                </View>
            );
        }

        if (mode === 'voice-text') {
            return (
                <View style={styles.content}>
                    <AppText variant="title" bold centered style={{ marginBottom: 16 }}>
                        ⌨️ 输入法语音记账
                    </AppText>
                    <AppText variant="caption" color={theme.colors.textSecondary} centered style={{ marginBottom: 20 }}>
                        使用输入法的语音功能，AI 自动分析记账
                    </AppText>

                    <TextInput
                        style={styles.textArea}
                        value={text}
                        onChangeText={setText}
                        placeholder="点击此处，使用输入法语音输入..."
                        placeholderTextColor={theme.colors.textSecondary + '80'}
                        multiline
                        autoFocus
                    />

                    <View style={styles.tipContainer}>
                        <MaterialCommunityIcons name="lightbulb-outline" size={16} color={theme.colors.primary} />
                        <AppText variant="caption" color={theme.colors.textSecondary} style={{ marginLeft: 6, flex: 1 }}>
                            提示：点击键盘上的麦克风图标使用语音输入
                        </AppText>
                    </View>

                    <View style={styles.buttonRow}>
                        <Pressable style={styles.cancelButton} onPress={onClose}>
                            <AppText color={theme.colors.textSecondary}>取消</AppText>
                        </Pressable>
                        <Pressable
                            style={[styles.primaryButton, loading && { opacity: 0.6 }]}
                            onPress={() => analyzeText(text)}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons name="robot" size={18} color="#fff" style={{ marginRight: 6 }} />
                                    <AppText color="#fff" bold>AI 分析</AppText>
                                </>
                            )}
                        </Pressable>
                    </View>
                </View>
            );
        }

        if (mode === 'camera') {
            return (
                <View style={styles.content}>
                    <AppText variant="title" bold centered style={{ marginBottom: 16 }}>
                        📷 拍照记账
                    </AppText>
                    <AppText variant="caption" color={theme.colors.textSecondary} centered style={{ marginBottom: 20 }}>
                        拍摄收据或票据，AI 自动识别
                    </AppText>

                    {imageUri ? (
                        <>
                            <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
                            <View style={styles.buttonRow}>
                                <Pressable style={styles.cancelButton} onPress={() => setImageUri(null)}>
                                    <AppText color={theme.colors.textSecondary}>重新选择</AppText>
                                </Pressable>
                                <Pressable
                                    style={[styles.primaryButton, loading && { opacity: 0.6 }]}
                                    onPress={analyzeImage}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <>
                                            <MaterialCommunityIcons name="robot" size={18} color="#fff" style={{ marginRight: 6 }} />
                                            <AppText color="#fff" bold>AI 识别</AppText>
                                        </>
                                    )}
                                </Pressable>
                            </View>
                        </>
                    ) : (
                        <>
                            <View style={styles.cameraOptions}>
                                <Pressable style={styles.cameraButton} onPress={() => pickImage(true)}>
                                    <MaterialCommunityIcons name="camera" size={36} color={theme.colors.primary} />
                                    <AppText style={{ marginTop: 8 }}>拍照</AppText>
                                </Pressable>
                                <Pressable style={styles.cameraButton} onPress={() => pickImage(false)}>
                                    <MaterialCommunityIcons name="image" size={36} color={theme.colors.primary} />
                                    <AppText style={{ marginTop: 8 }}>相册</AppText>
                                </Pressable>
                            </View>
                            <Pressable style={[styles.cancelButton, { marginTop: 20, alignSelf: 'center' }]} onPress={onClose}>
                                <AppText color={theme.colors.textSecondary}>取消</AppText>
                            </Pressable>
                        </>
                    )}
                </View>
            );
        }

        return null;
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.container, drafts.length > 0 && styles.containerBatch]}>{renderContent()}</View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: theme.colors.surface,
        borderRadius: 20,
        ...theme.shadows.large,
    },
    containerBatch: {
        height: '85%',
    },
    content: {
        padding: 24,
    },
    textArea: {
        backgroundColor: theme.colors.surfaceVariant,
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: theme.colors.textPrimary,
        minHeight: 120,
        textAlignVertical: 'top',
        marginBottom: 20,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    cancelButton: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 24,
        backgroundColor: theme.colors.surfaceVariant,
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 24,
        backgroundColor: theme.colors.primary,
    },
    micContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    micButton: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...theme.shadows.medium,
    },
    micButtonRecording: {
        backgroundColor: theme.colors.error,
    },
    cameraOptions: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 40,
        marginVertical: 20,
    },
    cameraButton: {
        alignItems: 'center',
        padding: 20,
        borderRadius: 16,
        backgroundColor: theme.colors.surfaceVariant,
        minWidth: 100,
    },
    previewImage: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        marginBottom: 20,
        backgroundColor: theme.colors.surfaceVariant,
    },
    tipContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surfaceVariant,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 20,
    },

    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    bannerWarn: {
        backgroundColor: '#fff3cd',
        borderWidth: 1,
        borderColor: '#ffeeba',
        borderRadius: theme.roundness,
        padding: 12,
        marginBottom: 12,
    },
    bannerInfo: {
        backgroundColor: '#d1ecf1',
        borderWidth: 1,
        borderColor: '#bee5eb',
        borderRadius: theme.roundness,
        padding: 12,
        marginBottom: 12,
    },

    draftCard: {
        backgroundColor: theme.colors.surfaceVariant,
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
    },
    draftHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    smallPrimaryBtn: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 10,
    },

    typeSelector: {
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        borderRadius: 10,
        padding: 2,
        marginBottom: 10,
    },
    typeBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 6,
        borderRadius: 8,
    },
    typeBtnActive: {
        backgroundColor: theme.colors.primary,
    },

    inputRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 10,
    },
    input: {
        backgroundColor: theme.colors.surface,
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        color: theme.colors.textPrimary,
        marginTop: 6,
    },
    multilineInput: {
        minHeight: 40,
        textAlignVertical: 'top',
    },
});
