import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  PlugZap,
  Save,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { getAiSettings, testAiSettings, updateAiSettings } from '../../api/aiSettings';
import type { AiConnectionTest, AiSettings, AiSettingsUpdate } from '../../types/ai';
import { ToggleSwitch } from '../ToggleSwitch';

type AiProviderSettingsCardProps = {
  onAiAssistChange?: (enabled: boolean) => void;
};

type ApiErrorDetails = {
  code?: string;
  message: string;
};

type SourceTone = 'green' | 'blue' | 'amber' | 'gray';

type SourceLabel = {
  value: string;
  tone: SourceTone;
};

const ERROR_MESSAGES: Record<string, string> = {
  AI_PROVIDER_AUTH_FAILED: 'Authentication failed. Check that the API key is valid and has model access.',
  AI_PROVIDER_RATE_LIMITED: 'Provider rate limit reached. Wait a moment and try again.',
  INVALID_AI_BASE_URL: 'Base URL is invalid or not on the server allowlist. Use an HTTPS provider endpoint.',
  AI_CONFIG_ENCRYPTION_NOT_CONFIGURED: 'Server encryption is not configured. The key can still be saved locally in development mode.',
  AI_CONFIG_DECRYPTION_FAILED: 'Could not decrypt the saved API key. The encryption key may have been rotated. Save the key again to recover.',
  AI_PROVIDER_DISABLED: 'AI Assist is turned off. Enable it before running a test.',
  AI_PROVIDER_NOT_CONFIGURED: 'No API key is configured. Enter a personal key or configure a system fallback.',
  AI_MODEL_NOT_CONFIGURED: 'No model is configured. Enter a model name or configure a system default.',
  AI_PROVIDER_BAD_REQUEST: 'The provider rejected the request. Verify model name and base URL.',
  AI_PROVIDER_UNAVAILABLE: 'The provider is unreachable. Check network and base URL.',
};

const FALLBACK_ERROR_MESSAGE = 'Request failed. Please try again.';

const sourceToneClasses: Record<SourceTone, string> = {
  green: 'border-[#C9E8D9] bg-[#EDF8F1] text-[#168B5E]',
  blue: 'border-[#CADFF8] bg-[#EEF6FF] text-[#2B6CB0]',
  amber: 'border-[#F4D7A1] bg-[#FFF7E6] text-[#9D5A12]',
  gray: 'border-[#E5E0DB] bg-[#FAF8F5] text-[#6F7782]',
};

const inputClass =
  'mt-1.5 w-full rounded-xl border border-[#EFE2D8] bg-white px-3 py-2 text-xs font-bold text-[#2F2925] outline-none shadow-sm transition placeholder:text-[#B6AFA8] focus:border-[#FFB8C7] focus:ring-2 focus:ring-[#FFD1DC]/40 disabled:cursor-not-allowed disabled:opacity-60';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const trimOrNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const savedValue = (value?: string | null): string | null => trimOrNull(value ?? '');

const extractApiError = (error: unknown): ApiErrorDetails => {
  let code: string | undefined;
  let rawMessage = FALLBACK_ERROR_MESSAGE;

  const response = isRecord(error) ? error.response : undefined;
  const data = isRecord(response) ? response.data : undefined;

  if (isRecord(data)) {
    if (typeof data.code === 'string' && data.code.trim().length > 0) {
      code = data.code;
    }
    if (typeof data.error === 'string' && data.error.trim().length > 0) {
      rawMessage = data.error;
    } else if (typeof data.message === 'string' && data.message.trim().length > 0) {
      rawMessage = data.message;
    }
  } else if (error instanceof Error && error.message.trim().length > 0) {
    rawMessage = error.message;
  }

  return {
    code,
    message: code && ERROR_MESSAGES[code] ? ERROR_MESSAGES[code] : rawMessage,
  };
};

const SourcePill = ({ label, source }: { label: string; source: SourceLabel }) => (
  <div className="rounded-xl border border-[#F1ECE7] bg-[#FAFAF9] px-3 py-2">
    <p className="text-[10px] font-black uppercase tracking-normal text-[#8B929C]">{label}</p>
    <span
      className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black ${sourceToneClasses[source.tone]}`}
    >
      {source.value}
    </span>
  </div>
);

export const AiProviderSettingsCard = ({ onAiAssistChange }: AiProviderSettingsCardProps) => {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [draftApiKey, setDraftApiKey] = useState('');
  const [draftBaseUrl, setDraftBaseUrl] = useState('');
  const [draftModel, setDraftModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<ApiErrorDetails | null>(null);
  const [testResult, setTestResult] = useState<AiConnectionTest | null>(null);

  const aliveRef = useRef(false);
  const testRequestRef = useRef(0);
  const onAiAssistChangeRef = useRef(onAiAssistChange);
  const lastNotifiedAiAssistRef = useRef<boolean | null>(null);

  useEffect(() => {
    onAiAssistChangeRef.current = onAiAssistChange;
  }, [onAiAssistChange]);

  const notifyAiAssistChange = (enabled: boolean) => {
    if (lastNotifiedAiAssistRef.current === enabled) return;
    lastNotifiedAiAssistRef.current = enabled;
    onAiAssistChangeRef.current?.(enabled);
  };

  useEffect(() => {
    aliveRef.current = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const nextSettings = await getAiSettings();
        if (!aliveRef.current) return;
        setSettings(nextSettings);
        setDraftApiKey('');
        setDraftBaseUrl(nextSettings.baseUrl ?? '');
        setDraftModel(nextSettings.model ?? '');
        notifyAiAssistChange(nextSettings.aiAssistEnabled);
      } catch (loadError) {
        if (!aliveRef.current) return;
        setError(extractApiError(loadError));
      } finally {
        if (aliveRef.current) setLoading(false);
      }
    };

    void load();

    return () => {
      aliveRef.current = false;
    };
    // notifyAiAssistChange is a stable closure over refs; safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keySource = useMemo<SourceLabel>(() => {
    if (trimOrNull(draftApiKey)) return { value: 'New personal key', tone: 'green' };
    if (!settings) return { value: 'Loading', tone: 'gray' };
    if (settings.usesUserApiKey) return { value: 'Personal key', tone: 'green' };
    if (settings.usesSystemFallback) return { value: 'System fallback', tone: 'blue' };
    return { value: 'Not configured', tone: 'amber' };
  }, [draftApiKey, settings]);

  const endpointSource = useMemo<SourceLabel>(() => {
    if (!settings) return { value: 'Loading', tone: 'gray' };
    return trimOrNull(draftBaseUrl)
      ? { value: 'Custom', tone: 'green' }
      : { value: 'System default', tone: 'blue' };
  }, [draftBaseUrl, settings]);

  const modelSource = useMemo<SourceLabel>(() => {
    if (!settings) return { value: 'Loading', tone: 'gray' };
    return trimOrNull(draftModel)
      ? { value: 'Custom', tone: 'green' }
      : { value: 'System default', tone: 'blue' };
  }, [draftModel, settings]);

  const statusMessage = useMemo(() => {
    if (!settings) return loading ? 'Loading AI provider settings…' : 'AI provider settings are unavailable.';
    if (trimOrNull(draftApiKey)) return 'A new personal API key is ready to test or save.';
    if (settings.usesUserApiKey) {
      return settings.apiKeyPreview
        ? `Using your personal API key (${settings.apiKeyPreview}).`
        : 'Using your personal API key.';
    }
    if (settings.usesSystemFallback) return 'Using the system fallback API key. Save a personal key to override it.';
    return 'No API key is configured. Enter a personal key or configure a system fallback.';
  }, [draftApiKey, loading, settings]);

  const hasProviderChanges = useMemo(() => {
    if (!settings) return false;
    return (
      Boolean(trimOrNull(draftApiKey)) ||
      trimOrNull(draftBaseUrl) !== savedValue(settings.baseUrl) ||
      trimOrNull(draftModel) !== savedValue(settings.model)
    );
  }, [draftApiKey, draftBaseUrl, draftModel, settings]);

  const keyPlaceholder = settings?.apiKeyPreview
    ? `${settings.apiKeyPreview} — enter a new key to replace`
    : 'sk-… (your provider API key)';

  const aiAssistOn = Boolean(settings?.aiAssistEnabled);
  const busy = loading || saving || testing || toggling;
  const canSave = Boolean(settings) && !busy && hasProviderChanges;
  const canTest = Boolean(settings) && aiAssistOn && !busy;
  const canClearKey = Boolean(settings?.usesUserApiKey) && !busy;

  const clearTransientFeedback = () => {
    setError(null);
    setTestResult(null);
  };

  const applySavedSettings = (nextSettings: AiSettings, resetDrafts: boolean) => {
    setSettings(nextSettings);
    if (resetDrafts) {
      setDraftApiKey('');
      setDraftBaseUrl(nextSettings.baseUrl ?? '');
      setDraftModel(nextSettings.model ?? '');
    }
    notifyAiAssistChange(nextSettings.aiAssistEnabled);
  };

  const handleToggleAiAssist = async () => {
    if (!settings || toggling) return;
    const previousSettings = settings;
    const nextEnabled = !settings.aiAssistEnabled;

    setError(null);
    setTestResult(null);
    setToggling(true);
    setSettings({ ...settings, aiAssistEnabled: nextEnabled });
    notifyAiAssistChange(nextEnabled);

    try {
      const nextSettings = await updateAiSettings({ aiAssistEnabled: nextEnabled });
      if (!aliveRef.current) return;
      applySavedSettings(nextSettings, false);
    } catch (toggleError) {
      if (!aliveRef.current) return;
      setSettings(previousSettings);
      notifyAiAssistChange(previousSettings.aiAssistEnabled);
      setError(extractApiError(toggleError));
    } finally {
      if (aliveRef.current) setToggling(false);
    }
  };

  const handleSave = async () => {
    if (!settings || !canSave) return;

    const payload: AiSettingsUpdate = {};
    const apiKey = trimOrNull(draftApiKey);
    const baseUrl = trimOrNull(draftBaseUrl);
    const model = trimOrNull(draftModel);

    if (apiKey) payload.apiKey = apiKey;
    if (baseUrl !== savedValue(settings.baseUrl)) payload.baseUrl = baseUrl;
    if (model !== savedValue(settings.model)) payload.model = model;

    if (Object.keys(payload).length === 0) return;

    setSaving(true);
    setError(null);
    setTestResult(null);

    try {
      const nextSettings = await updateAiSettings(payload);
      if (!aliveRef.current) return;
      applySavedSettings(nextSettings, true);
    } catch (saveError) {
      if (!aliveRef.current) return;
      setError(extractApiError(saveError));
    } finally {
      if (aliveRef.current) setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!canTest) return;

    const payload: AiSettingsUpdate = {};
    const apiKey = trimOrNull(draftApiKey);
    const baseUrl = trimOrNull(draftBaseUrl);
    const model = trimOrNull(draftModel);

    if (apiKey) payload.apiKey = apiKey;
    if (baseUrl) payload.baseUrl = baseUrl;
    if (model) payload.model = model;

    const requestId = testRequestRef.current + 1;
    testRequestRef.current = requestId;

    setTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const result = await testAiSettings(payload);
      if (!aliveRef.current || testRequestRef.current !== requestId) return;
      setTestResult(result);
    } catch (testError) {
      if (!aliveRef.current || testRequestRef.current !== requestId) return;
      setError(extractApiError(testError));
    } finally {
      if (aliveRef.current && testRequestRef.current === requestId) setTesting(false);
    }
  };

  const handleClearKey = async () => {
    if (!canClearKey) return;
    const confirmed = window.confirm(
      'Clear your personal AI API key? The system fallback key will be used if available.'
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setTestResult(null);

    try {
      const nextSettings = await updateAiSettings({ clearApiKey: true });
      if (!aliveRef.current) return;
      setDraftApiKey('');
      applySavedSettings(nextSettings, false);
    } catch (clearError) {
      if (!aliveRef.current) return;
      setError(extractApiError(clearError));
    } finally {
      if (aliveRef.current) setSaving(false);
    }
  };

  const testButtonTitle = !settings
    ? undefined
    : !aiAssistOn
      ? 'Turn on AI Assist before testing.'
      : undefined;

  return (
    <div className="bg-white border border-[#EFE2D8] rounded-[24px] p-6 shadow-[0_12px_28px_rgba(92,65,45,0.06)] flex flex-col justify-between min-h-[340px] md:col-span-2 xl:col-span-2">
      <div>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#FFF0F2] text-[#FF6F8F]">
              <Sparkles size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-[17px] font-black text-[#2F2925]">AI Provider</h3>
              <p className="text-[11px] font-semibold text-[#8B929C]">Configure AI Assist and provider access</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black text-[#7B8491]">AI Assist</span>
            <ToggleSwitch
              label="AI Assist"
              checked={aiAssistOn}
              disabled={!settings || busy}
              onClick={handleToggleAiAssist}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-[#F1ECE7] bg-[#FAFAF9] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <KeyRound size={15} className="mt-0.5 shrink-0 text-[#FF6F8F]" />
            <div>
              <p className="text-xs font-black text-[#2F2925]">{statusMessage}</p>
              <p className="mt-1 text-[10px] font-semibold text-[#8B929C]">
                Test sends the current form values as a one-off override and never saves automatically.
              </p>
            </div>
          </div>
        </div>

        {!aiAssistOn && settings && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#F4D7A1] bg-[#FFF7E6] px-3 py-2 text-xs font-bold text-[#9D5A12]">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            AI Assist is off. Provider settings can still be edited, but tests and AI bookkeeping will not run.
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <SourcePill label="Key source" source={keySource} />
          <SourcePill label="Endpoint source" source={endpointSource} />
          <SourcePill label="Model source" source={modelSource} />
        </div>

        {loading && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#EFE2D8] bg-[#FFFDFB] px-3 py-2 text-xs font-bold text-[#7B8491]">
            <Loader2 size={14} className="animate-spin" />
            Loading provider settings…
          </div>
        )}

        {settings && !settings.encryptionConfigured && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#F4D7A1] bg-[#FFF7E6] px-3 py-2 text-xs font-bold text-[#9D5A12]">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            Server-side encryption is not configured. Personal API keys will be saved locally for this development setup.
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <label className="text-[11px] font-black text-[#4E3629]">
            API Key
            <input
              type="password"
              name="ai-api-key"
              value={draftApiKey}
              disabled={busy}
              onChange={(event) => {
                clearTransientFeedback();
                setDraftApiKey(event.target.value);
              }}
              placeholder={keyPlaceholder}
              className={inputClass}
              autoComplete="off"
              spellCheck={false}
            />
            <span className="mt-1 block text-[10px] font-semibold text-[#8B929C]">
              Leave empty to keep the saved key or the system fallback.
            </span>
          </label>

          <label className="text-[11px] font-black text-[#4E3629]">
            Base URL
            <input
              type="url"
              name="ai-base-url"
              value={draftBaseUrl}
              disabled={busy}
              onChange={(event) => {
                clearTransientFeedback();
                setDraftBaseUrl(event.target.value);
              }}
              placeholder={settings?.effectiveBaseUrl || 'https://api.openai.com/v1'}
              className={inputClass}
              autoComplete="off"
              spellCheck={false}
            />
            <span
              className="mt-1 block truncate text-[10px] font-semibold text-[#8B929C]"
              title={settings?.effectiveBaseUrl}
            >
              Effective: {settings?.effectiveBaseUrl || 'Not configured'}
            </span>
          </label>

          <label className="text-[11px] font-black text-[#4E3629]">
            Model
            <input
              type="text"
              name="ai-model"
              value={draftModel}
              disabled={busy}
              onChange={(event) => {
                clearTransientFeedback();
                setDraftModel(event.target.value);
              }}
              placeholder={settings?.effectiveModel || 'gpt-4o-mini'}
              className={inputClass}
              autoComplete="off"
              spellCheck={false}
            />
            <span
              className="mt-1 block truncate text-[10px] font-semibold text-[#8B929C]"
              title={settings?.effectiveModel}
            >
              Effective: {settings?.effectiveModel || 'Not configured'}
            </span>
          </label>
        </div>

        <div role="status" aria-live="polite" aria-atomic="true">
          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-[#F8C7CE] bg-[#FFF0F2] px-3 py-2 text-xs font-bold text-[#C44B61]"
            >
              <div className="flex items-start gap-2">
                <XCircle size={14} className="mt-0.5 shrink-0" />
                <div>
                  <p>{error.message}</p>
                  {error.code && (
                    <p className="mt-0.5 text-[10px] font-black uppercase tracking-normal text-[#D46A7A]">
                      {error.code}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {testResult && (
            <div
              className={`mt-4 rounded-xl border px-3 py-2 text-xs font-bold ${
                testResult.ok
                  ? 'border-[#C9E8D9] bg-[#EDF8F1] text-[#168B5E]'
                  : 'border-[#F8C7CE] bg-[#FFF0F2] text-[#C44B61]'
              }`}
            >
              <div className="flex items-start gap-2">
                {testResult.ok ? (
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                ) : (
                  <XCircle size={14} className="mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p>{testResult.message}</p>
                  <p
                    className="mt-0.5 truncate text-[10px] font-black"
                    title={`${testResult.model} · ${testResult.baseUrl}`}
                  >
                    {testResult.model} · {testResult.baseUrl} · {testResult.latencyMs}ms
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6F8F] px-4 py-2.5 text-xs font-black text-white shadow-[0_8px_18px_rgba(255,111,143,0.2)] transition hover:bg-[#FF5B7F] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving…' : 'Save provider settings'}
        </button>

        <button
          type="button"
          onClick={handleTest}
          disabled={!canTest}
          title={testButtonTitle}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#EFE2D8] bg-white px-4 py-2.5 text-xs font-black text-[#2F2925] shadow-sm transition hover:bg-[#FAF8F5] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} />}
          {testing ? 'Testing…' : 'Test connection'}
        </button>

        {settings?.usesUserApiKey && (
          <button
            type="button"
            onClick={handleClearKey}
            disabled={!canClearKey}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#FFD9DF] bg-[#FFF7F8] px-4 py-2.5 text-xs font-black text-[#C44B61] shadow-sm transition hover:bg-[#FFF0F2] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 size={14} />
            Clear personal key
          </button>
        )}
      </div>
    </div>
  );
};
