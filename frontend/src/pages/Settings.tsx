import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Bell,
  Check,
  CreditCard,
  LoaderCircle,
  Moon,
  ReceiptText,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  Sparkles,
  SunMedium,
  UserRound,
  WalletCards,
} from 'lucide-react';
import api from '../api/axiosInstance';
import { Card } from '../components/Card';
import { CuteSticker } from '../components/CuteStickers';
import { useAuthStore } from '../store/useAuthStore';

interface SettingsData {
  id: string;
  userId: string;
  defaultCurrency: string;
  monthStartDay: number;
  receiptReminders: boolean;
  budgetAlerts: boolean;
  weeklyReport: boolean;
  aiAssistEnabled: boolean;
}

interface SettingsForm {
  displayName: string;
  defaultCurrency: string;
  monthStartDay: number;
  receiptReminders: boolean;
  budgetAlerts: boolean;
  weeklyReport: boolean;
  aiAssistEnabled: boolean;
}

type RawSettings = {
  id?: string | number;
  user_id?: string | number;
  userId?: string | number;
  default_currency?: string;
  defaultCurrency?: string;
  month_start_day?: number | string;
  monthStartDay?: number | string;
  receipt_reminders?: boolean | number | string;
  receiptReminders?: boolean | number | string;
  budget_alerts?: boolean | number | string;
  budgetAlerts?: boolean | number | string;
  weekly_report?: boolean | number | string;
  weeklyReport?: boolean | number | string;
  ai_assist_enabled?: boolean | number | string;
  aiAssistEnabled?: boolean | number | string;
};

type RawUser = {
  id?: string | number;
  email?: string;
  name?: string | null;
};

type ToggleKey = 'receiptReminders' | 'budgetAlerts' | 'weeklyReport' | 'aiAssistEnabled';

const CURRENCY_OPTIONS = [
  { code: 'USD', label: 'USD', helper: 'US Dollar', color: '#7ACB9C' },
  { code: 'CNY', label: 'CNY', helper: 'Chinese Yuan', color: '#FF8C94' },
  { code: 'EUR', label: 'EUR', helper: 'Euro', color: '#64B5F6' },
  { code: 'JPY', label: 'JPY', helper: 'Japanese Yen', color: '#FFD54F' },
  { code: 'GBP', label: 'GBP', helper: 'British Pound', color: '#BA68C8' },
  { code: 'HKD', label: 'HKD', helper: 'Hong Kong Dollar', color: '#FFB87A' },
];

const toBool = (value: unknown, fallback: boolean) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  return fallback;
};

const normalizeSettings = (raw?: RawSettings): SettingsData => ({
  id: String(raw?.id ?? 'local-settings'),
  userId: String(raw?.user_id ?? raw?.userId ?? ''),
  defaultCurrency: String(raw?.default_currency ?? raw?.defaultCurrency ?? 'USD'),
  monthStartDay: Number(raw?.month_start_day ?? raw?.monthStartDay ?? 1),
  receiptReminders: toBool(raw?.receipt_reminders ?? raw?.receiptReminders, true),
  budgetAlerts: toBool(raw?.budget_alerts ?? raw?.budgetAlerts, true),
  weeklyReport: toBool(raw?.weekly_report ?? raw?.weeklyReport, false),
  aiAssistEnabled: toBool(raw?.ai_assist_enabled ?? raw?.aiAssistEnabled, true),
});

const formFrom = (settings: SettingsData, user?: RawUser | null): SettingsForm => ({
  displayName: String(user?.name || ''),
  defaultCurrency: settings.defaultCurrency,
  monthStartDay: settings.monthStartDay,
  receiptReminders: settings.receiptReminders,
  budgetAlerts: settings.budgetAlerts,
  weeklyReport: settings.weeklyReport,
  aiAssistEnabled: settings.aiAssistEnabled,
});

const fallbackUser = (current: RawUser | null): RawUser => ({
  id: current?.id || 'local-user',
  email: current?.email || 'mimi@example.com',
  name: current?.name || 'Mimi',
});

const ToggleRow = ({
  title,
  body,
  checked,
  onChange,
  icon,
}: {
  title: string;
  body: string;
  checked: boolean;
  onChange: () => void;
  icon: ReactNode;
}) => (
  <button
    type="button"
    onClick={onChange}
    className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-[20px] border border-[#EFE2D8] bg-white px-4 py-3 text-left transition hover:bg-[#FFF8F2]"
    aria-label={title}
    aria-pressed={checked}
  >
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-[#FFF2E7] text-[#FF7F96]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-black text-[#2F2925]">{title}</span>
        <span className="mt-0.5 block text-[12px] font-bold leading-snug text-[#7B8491]">{body}</span>
      </span>
    </span>
    <span
      className={`relative h-8 w-14 shrink-0 rounded-full border transition ${
        checked ? 'border-[#FF8A9B] bg-[#FF8A9B]' : 'border-[#E4D8CD] bg-[#F7EFE8]'
      }`}
      aria-hidden="true"
    >
      <span
        className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-[0_4px_10px_rgba(92,65,45,0.18)] transition ${
          checked ? 'left-7' : 'left-1'
        }`}
      />
    </span>
  </button>
);

export const Settings = () => {
  const authUser = useAuthStore((state) => state.user);
  const [user, setUser] = useState<RawUser | null>(authUser);
  const [settings, setSettings] = useState<SettingsData>(() => normalizeSettings());
  const [form, setForm] = useState<SettingsForm>(() => formFrom(normalizeSettings(), authUser));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      setSavedMessage(null);

      try {
        const response = await api.get('/settings');
        if (!alive) return;
        const nextUser: RawUser = response.data?.user || fallbackUser(useAuthStore.getState().user);
        const nextSettings = normalizeSettings(response.data?.settings);
        setUser(nextUser);
        setSettings(nextSettings);
        setForm(formFrom(nextSettings, nextUser));
        useAuthStore.setState((current) => ({ ...current, user: nextUser as { id: string; email: string; name?: string } }));
        setOfflineMode(false);
      } catch {
        if (!alive) return;
        const nextUser = fallbackUser(useAuthStore.getState().user);
        const nextSettings = normalizeSettings();
        setUser(nextUser);
        setSettings(nextSettings);
        setForm(formFrom(nextSettings, nextUser));
        setOfflineMode(true);
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const dirty = useMemo(() => {
    const baseline = formFrom(settings, user);
    return JSON.stringify(baseline) !== JSON.stringify(form);
  }, [form, settings, user]);

  const selectedCurrency = CURRENCY_OPTIONS.find((currency) => currency.code === form.defaultCurrency) || CURRENCY_OPTIONS[0];
  const activeToggleCount = [
    form.receiptReminders,
    form.budgetAlerts,
    form.weeklyReport,
    form.aiAssistEnabled,
  ].filter(Boolean).length;

  const updateToggle = (key: ToggleKey) => {
    setForm((current) => ({ ...current, [key]: !current[key] }));
  };

  const handleSave = async () => {
    if (form.displayName.trim().length > 80) {
      setError('Display name must be 80 characters or less.');
      return;
    }

    setSaving(true);
    setError(null);
    setSavedMessage(null);

    const payload = {
      displayName: form.displayName.trim(),
      defaultCurrency: form.defaultCurrency,
      monthStartDay: form.monthStartDay,
      receiptReminders: form.receiptReminders,
      budgetAlerts: form.budgetAlerts,
      weeklyReport: form.weeklyReport,
      aiAssistEnabled: form.aiAssistEnabled,
    };

    try {
      if (offlineMode) {
        const nextUser = { ...fallbackUser(user), name: payload.displayName || null };
        const nextSettings = normalizeSettings({
          id: settings.id,
          userId: settings.userId,
          defaultCurrency: payload.defaultCurrency,
          monthStartDay: payload.monthStartDay,
          receiptReminders: payload.receiptReminders,
          budgetAlerts: payload.budgetAlerts,
          weeklyReport: payload.weeklyReport,
          aiAssistEnabled: payload.aiAssistEnabled,
        });
        setUser(nextUser);
        setSettings(nextSettings);
        setForm(formFrom(nextSettings, nextUser));
        setSavedMessage('Saved locally for preview.');
      } else {
        const response = await api.patch('/settings', payload);
        const nextUser: RawUser = response.data?.user || user;
        const nextSettings = normalizeSettings(response.data?.settings);
        setUser(nextUser);
        setSettings(nextSettings);
        setForm(formFrom(nextSettings, nextUser));
        useAuthStore.setState((current) => ({ ...current, user: nextUser as { id: string; email: string; name?: string } }));
        setSavedMessage('Settings saved.');
      }
    } catch {
      setError('Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page flex h-full min-h-0 flex-col gap-4 text-[#4E3629]">
      <div className="flex flex-col gap-4 min-[1120px]:flex-row min-[1120px]:items-start min-[1120px]:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[11px] font-black uppercase text-[#FF7F96]">Nest</span>
            {offlineMode && (
              <span className="rounded-full bg-[#FFF2E7] px-2.5 py-0.5 text-[11px] font-black text-[#9D4E2B]">
                Local Preview
              </span>
            )}
          </div>
          <h2 className="text-[32px] font-black leading-tight tracking-tight text-[#2F2925]">Settings</h2>
          <p className="mt-1 text-[15px] font-bold text-[#6F7785]">Tune your account, reminders, and bookkeeping defaults.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#EFE2D8] bg-white text-[#2F2925] shadow-[0_8px_18px_rgba(92,65,45,0.08)] transition hover:bg-[#FFF8F2]"
            aria-label="Refresh settings"
          >
            <RefreshCw size={18} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !dirty}
            className="flex h-10 items-center gap-2 rounded-full bg-gradient-to-r from-[#FF6F8F] to-[#FF8A9B] px-5 text-sm font-black text-white shadow-[0_12px_24px_rgba(255,111,143,0.25)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} strokeWidth={3} />}
            Save
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 min-[1280px]:grid-cols-4">
        <Card noPadding className="relative min-h-[112px] overflow-hidden rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
          <div className="absolute -bottom-8 -right-8 h-[112px] w-[112px] rounded-full bg-[#FFF0F2]" />
          <p className="relative z-[1] text-[13px] font-black text-[#536073]">Profile</p>
          <p className="relative z-[1] mt-3 truncate text-[26px] font-black leading-tight text-[#2F2925]">
            {form.displayName || user?.email || 'Mimi'}
          </p>
          <p className="relative z-[1] mt-2 text-[11px] font-black text-[#FF7F96]">{user?.email || 'Preview account'}</p>
        </Card>
        <Card noPadding className="relative min-h-[112px] overflow-hidden rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
          <div className="absolute -bottom-8 -right-8 h-[112px] w-[112px] rounded-full bg-[#EAFBF1]" />
          <p className="relative z-[1] text-[13px] font-black text-[#536073]">Currency</p>
          <p className="relative z-[1] mt-3 text-[29px] font-black leading-tight text-[#2F2925]">{selectedCurrency.label}</p>
          <p className="relative z-[1] mt-2 text-[11px] font-black text-[#169B61]">{selectedCurrency.helper}</p>
        </Card>
        <Card noPadding className="relative min-h-[112px] overflow-hidden rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
          <div className="absolute -bottom-8 -right-8 h-[112px] w-[112px] rounded-full bg-[#FFF2E7]" />
          <p className="relative z-[1] text-[13px] font-black text-[#536073]">Month Starts</p>
          <p className="relative z-[1] mt-3 text-[29px] font-black leading-tight text-[#2F2925]">Day {form.monthStartDay}</p>
          <p className="relative z-[1] mt-2 text-[11px] font-black text-[#9D4E2B]">Budget rhythm</p>
        </Card>
        <Card noPadding className="relative min-h-[112px] overflow-hidden rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
          <div className="absolute -bottom-8 -right-8 h-[112px] w-[112px] rounded-full bg-[#EDF5FF]" />
          <p className="relative z-[1] text-[13px] font-black text-[#536073]">Active Helpers</p>
          <p className="relative z-[1] mt-3 text-[29px] font-black leading-tight text-[#2F2925]">{activeToggleCount}/4</p>
          <p className="relative z-[1] mt-2 text-[11px] font-black text-[#3575A8]">Reminder switches on</p>
        </Card>
      </div>

      {error && (
        <div className="rounded-[16px] border border-[#F8C7CE] bg-[#FFF0F2] px-4 py-3 text-sm font-black text-[#C44B61]">
          {error}
        </div>
      )}
      {savedMessage && (
        <div className="rounded-[16px] border border-[#CBEAD7] bg-[#F4FBF6] px-4 py-3 text-sm font-black text-[#168B5E]">
          {savedMessage}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 min-[1180px]:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-h-0 overflow-auto pr-1">
          {loading ? (
            <Card noPadding className="flex min-h-[360px] items-center justify-center rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF2E7] px-4 py-2 text-sm font-black text-[#9D4E2B]">
                <LoaderCircle className="animate-spin" size={16} />
                Loading settings shelf
              </div>
            </Card>
          ) : (
            <div className="grid gap-4">
              <Card noPadding className="rounded-[24px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#FFF0F2] text-[#FF6F8F]">
                    <UserRound size={21} strokeWidth={2.7} />
                  </div>
                  <div>
                    <h3 className="text-[18px] font-black text-[#2F2925]">Account Card</h3>
                    <p className="text-[12px] font-bold text-[#8B929C]">Your cozy display details</p>
                  </div>
                </div>

                <div className="grid gap-4 min-[860px]:grid-cols-[minmax(240px,1fr)_minmax(240px,1fr)]">
                  <label htmlFor="settings-display-name" className="block">
                    <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Display Name</span>
                    <input
                      id="settings-display-name"
                      value={form.displayName}
                      onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                      placeholder="Pick a cozy name"
                      className="h-12 w-full rounded-[16px] border border-[#EFE2D8] bg-white px-4 text-sm font-bold text-[#4E3629] outline-none transition placeholder:text-[#A7A0A0] focus:ring-4 focus:ring-[#FFD1DC]/40"
                    />
                  </label>

                  <label htmlFor="settings-email" className="block">
                    <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Email</span>
                    <input
                      id="settings-email"
                      value={user?.email || ''}
                      readOnly
                      className="h-12 w-full rounded-[16px] border border-[#EFE2D8] bg-[#F7EFE8] px-4 text-sm font-bold text-[#6F7785] outline-none"
                    />
                  </label>
                </div>
              </Card>

              <Card noPadding className="rounded-[24px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#EAFBF1] text-[#168B5E]">
                    <WalletCards size={21} strokeWidth={2.7} />
                  </div>
                  <div>
                    <h3 className="text-[18px] font-black text-[#2F2925]">Bookkeeping Defaults</h3>
                    <p className="text-[12px] font-bold text-[#8B929C]">Used across budgets, reports, and quick entry surfaces</p>
                  </div>
                </div>

                <div className="grid gap-4 min-[900px]:grid-cols-[1fr_220px]">
                  <div>
                    <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Default Currency</span>
                    <div className="grid grid-cols-2 gap-2 min-[680px]:grid-cols-3">
                      {CURRENCY_OPTIONS.map((currency) => (
                        <button
                          key={currency.code}
                          type="button"
                          onClick={() => setForm((current) => ({ ...current, defaultCurrency: currency.code }))}
                          aria-label={`${currency.code} ${currency.helper}`}
                          className={`flex min-h-[70px] cursor-pointer items-center justify-between gap-3 rounded-[18px] border px-4 py-3 text-left transition ${
                            form.defaultCurrency === currency.code
                              ? 'border-[#FF8A9B] bg-[#FFF0F2] shadow-[0_8px_18px_rgba(255,127,150,0.12)]'
                              : 'border-[#EFE2D8] bg-white hover:bg-[#FFF8F2]'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block text-[16px] font-black text-[#2F2925]">{currency.label}</span>
                            <span className="mt-0.5 block truncate text-[11px] font-bold text-[#8B929C]">{currency.helper}</span>
                          </span>
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: currency.color }}>
                            {form.defaultCurrency === currency.code && <Check size={15} strokeWidth={3} className="text-white" />}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <label htmlFor="settings-month-start" className="block">
                    <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Month Start Day</span>
                    <select
                      id="settings-month-start"
                      value={form.monthStartDay}
                      onChange={(event) => setForm((current) => ({ ...current, monthStartDay: Number(event.target.value) }))}
                      className="h-12 w-full rounded-[16px] border border-[#EFE2D8] bg-white px-4 text-sm font-black text-[#4E3629] outline-none transition focus:ring-4 focus:ring-[#FFD1DC]/40"
                    >
                      {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
                        <option key={day} value={day}>
                          Day {day}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 rounded-[16px] bg-[#FFF8F2] px-3 py-3 text-[12px] font-bold leading-relaxed text-[#7B8491]">
                      Reports still use selected ranges, while budget cards can align around this day.
                    </p>
                  </label>
                </div>
              </Card>

              <Card noPadding className="rounded-[24px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#EDF5FF] text-[#3575A8]">
                    <Bell size={21} strokeWidth={2.7} />
                  </div>
                  <div>
                    <h3 className="text-[18px] font-black text-[#2F2925]">Helper Switches</h3>
                    <p className="text-[12px] font-bold text-[#8B929C]">Quiet reminders for the repeated bookkeeping chores</p>
                  </div>
                </div>

                <div className="grid gap-3 min-[900px]:grid-cols-2">
                  <ToggleRow
                    title="Receipt reminders"
                    body="Nudge quick receipt cleanup after busy days."
                    checked={form.receiptReminders}
                    onChange={() => updateToggle('receiptReminders')}
                    icon={<ReceiptText size={20} strokeWidth={2.6} />}
                  />
                  <ToggleRow
                    title="Budget alerts"
                    body="Call out categories that are close to their cap."
                    checked={form.budgetAlerts}
                    onChange={() => updateToggle('budgetAlerts')}
                    icon={<CreditCard size={20} strokeWidth={2.6} />}
                  />
                  <ToggleRow
                    title="Weekly report"
                    body="Keep a small summary ready at the end of the week."
                    checked={form.weeklyReport}
                    onChange={() => updateToggle('weeklyReport')}
                    icon={<SunMedium size={20} strokeWidth={2.6} />}
                  />
                  <ToggleRow
                    title="AI assist"
                    body="Use smart parsing hints for notes and receipts."
                    checked={form.aiAssistEnabled}
                    onChange={() => updateToggle('aiAssistEnabled')}
                    icon={<Sparkles size={20} strokeWidth={2.6} />}
                  />
                </div>
              </Card>
            </div>
          )}
        </div>

        <div className="hidden min-h-0 min-[1180px]:block">
          <Card noPadding className="sticky top-0 rounded-[24px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
            <div className="rounded-[22px] border border-[#F0DFD0] bg-[#FFF4E8] px-4 py-5 text-center">
              <CuteSticker
                name="settings-cat"
                className="mx-auto h-[154px] w-[184px] drop-shadow-[0_10px_16px_rgba(92,65,45,0.12)]"
                title="Settings helper cat"
              />
              <h3 className="mt-2 text-[18px] font-black text-[#2F2925]">Control Shelf</h3>
              <p className="mt-1 text-[12px] font-bold leading-relaxed text-[#7B8491]">
                Account details and little automation switches stay together here.
              </p>
            </div>

            <div className="mt-3 grid gap-2.5">
              <div className="rounded-[18px] bg-[#FAF6F0] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#7B8491]">Save State</span>
                  <span className={`text-xs font-black ${dirty ? 'text-[#B66B12]' : 'text-[#168B5E]'}`}>
                    {dirty ? 'Unsaved' : 'Synced'}
                  </span>
                </div>
                <p className="mt-1.5 text-lg font-black text-[#2F2925]">{dirty ? 'Review changes' : 'All tidy'}</p>
              </div>

              <div className="rounded-[18px] bg-[#FAF6F0] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#7B8491]">Currency</span>
                  <WalletCards size={15} strokeWidth={2.6} className="text-[#FF7F96]" />
                </div>
                <p className="mt-1.5 text-lg font-black text-[#2F2925]">{selectedCurrency.label}</p>
              </div>

              <div className="rounded-[18px] border border-[#F0DFD0] bg-[#FFF9F2] px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-[#2F2925]">Brightness</p>
                  <SettingsIcon size={15} strokeWidth={2.6} className="text-[#9D4E2B]" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-center gap-2 rounded-[15px] bg-white px-3 py-2 text-xs font-black text-[#FF7F96]">
                    <SunMedium size={14} strokeWidth={2.6} />
                    Cozy
                  </div>
                  <div className="flex items-center justify-center gap-2 rounded-[15px] bg-[#F7EFE8] px-3 py-2 text-xs font-black text-[#8B929C]">
                    <Moon size={14} strokeWidth={2.6} />
                    Soon
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
