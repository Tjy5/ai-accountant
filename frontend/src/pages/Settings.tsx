import { useEffect, useState } from 'react';
import {
  Bell,
  ChevronRight,
  Cloud,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  FileBarChart,
  Folder,
  Globe,
  Laptop,
  Lock,
  MessageSquare,
  Monitor,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Sliders,
  FileText,
  Sun,
  Tag,
  Target,
  Trash2,
  Upload,
  UserRound,
  Calendar,
  Clock,
  Settings as SettingsIcon,
} from 'lucide-react';
import api from '../api/axiosInstance';
import { CuteSticker } from '../components/CuteStickers';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { AiProviderSettingsCard } from '../components/settings/AiProviderSettingsCard';
import { useAuthStore } from '../store/useAuthStore';
import sarahAvatar from '../assets/sarah_avatar.png';

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

const CURRENCY_OPTIONS = [
  { code: 'USD', label: 'USD - US Dollar ($)' },
  { code: 'CNY', label: 'CNY - Chinese Yuan (¥)' },
  { code: 'EUR', label: 'EUR - Euro (€)' },
  { code: 'JPY', label: 'JPY - Japanese Yen (¥)' },
  { code: 'GBP', label: 'GBP - British Pound (£)' },
  { code: 'HKD', label: 'HKD - Hong Kong Dollar ($)' },
];

const TIMEZONES = [
  '(UTC-08:00) Pacific Time (US & Canada)',
  '(UTC-05:00) Eastern Time (US & Canada)',
  '(UTC+00:00) Greenwich Mean Time (London)',
  '(UTC+01:00) Central European Time (Paris)',
  '(UTC+08:00) China Standard Time (Beijing)',
  '(UTC+09:00) Japan Standard Time (Tokyo)',
];

const THEMES = ['Light', 'Dark', 'Cozy'];
const DATE_FORMATS = ['Oct 31, 2024', '2024-10-31', '31/10/2024'];
const NUMBER_FORMATS = ['1,234.56', '1.234,56', '1 234.56'];
const LANGUAGES = ['English', 'Chinese', 'Spanish', 'French'];
const DASHBOARDS = ['Overview', 'Detailed', 'Analytics'];
const CATEGORIES = ['Uncategorized', 'Food', 'Transport', 'Utilities', 'Entertainment', 'Shopping'];
const RETENTIONS = ['1 year', '5 years', '7 years', 'Indefinitely'];

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
  email: current?.email || 'sarah@example.com',
  name: current?.name || 'Sarah',
});

export const Settings = () => {
  const authUser = useAuthStore((state) => state.user);
  const [user, setUser] = useState<RawUser | null>(authUser);
  const [settings, setSettings] = useState<SettingsData>(() => normalizeSettings());
  const [form, setForm] = useState<SettingsForm>(() => formFrom(normalizeSettings(), authUser));
  const [savingSettings, setSavingSettings] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit Profile mode state
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Local preferences state (synced with localStorage)
  const [timeZone, setTimeZone] = useState(() => localStorage.getItem('settings_timezone') || '(UTC-08:00) Pacific Time (US & Canada)');
  const [theme, setTheme] = useState(() => localStorage.getItem('settings_theme') || 'Light');
  const [dateFormat, setDateFormat] = useState(() => localStorage.getItem('settings_date_format') || 'Oct 31, 2024');
  const [numberFormat, setNumberFormat] = useState(() => localStorage.getItem('settings_number_format') || '1,234.56');
  const [language, setLanguage] = useState(() => localStorage.getItem('settings_language') || 'English');
  const [defaultDashboard, setDefaultDashboard] = useState(() => localStorage.getItem('settings_default_dashboard') || 'Overview');
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem('settings_compact_mode') === 'true');
  const [goalUpdates, setGoalUpdates] = useState(() => localStorage.getItem('settings_goal_updates') !== 'false');
  const [autoCategorize, setAutoCategorize] = useState(() => localStorage.getItem('settings_auto_categorize') !== 'false');
  const [recurringTransactions, setRecurringTransactions] = useState(() => localStorage.getItem('settings_recurring_transactions') !== 'false');
  const [defaultCategory, setDefaultCategory] = useState(() => localStorage.getItem('settings_default_category') || 'Uncategorized');
  const [dataRetention, setDataRetention] = useState(() => localStorage.getItem('settings_data_retention') || '7 years');
  const [lastBackupDate, setLastBackupDate] = useState(() => localStorage.getItem('settings_last_backup') || 'Never');

  // Load Settings
  useEffect(() => {
    let alive = true;
    const load = async () => {
      setError(null);
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
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  // General Settings Save (auto-saves non-profile backend fields)
  const handleSave = async (updatedForm: SettingsForm) => {
    setError(null);
    setSavingSettings(true);

    const payload = {
      displayName: updatedForm.displayName.trim(),
      defaultCurrency: updatedForm.defaultCurrency,
      monthStartDay: updatedForm.monthStartDay,
      receiptReminders: updatedForm.receiptReminders,
      budgetAlerts: updatedForm.budgetAlerts,
      weeklyReport: updatedForm.weeklyReport,
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
          aiAssistEnabled: updatedForm.aiAssistEnabled,
        });
        setUser(nextUser);
        setSettings(nextSettings);
        setForm(formFrom(nextSettings, nextUser));
      } else {
        const response = await api.patch('/settings', payload);
        const nextUser: RawUser = response.data?.user || user;
        const nextSettings = normalizeSettings(response.data?.settings);
        setUser(nextUser);
        setSettings(nextSettings);
        setForm(formFrom(nextSettings, nextUser));
        useAuthStore.setState((current) => ({ ...current, user: nextUser as { id: string; email: string; name?: string } }));
      }
      return true;
    } catch {
      setError('Could not save settings.');
      return false;
    } finally {
      setSavingSettings(false);
    }
  };

  // Profile Edit Toggle
  const toggleEditProfile = async () => {
    if (isEditingProfile) {
      if (form.displayName.trim().length > 80) {
        setError('Display name must be 80 characters or less.');
        return;
      }
      const saved = await handleSave(form);
      if (saved) {
        setIsEditingProfile(false);
      }
    } else {
      setError(null);
      setIsEditingProfile(true);
    }
  };

  // Local preferences change handler
  const handleLocalChange = <T extends string | boolean>(key: string, value: T, setter: (val: T) => void) => {
    setError(null);
    setter(value);
    localStorage.setItem(key, String(value));
  };

  // Toggle backend boolean switches
  const toggleBackendSwitch = async (key: 'receiptReminders' | 'budgetAlerts' | 'weeklyReport') => {
    if (savingSettings) return;
    const previousForm = form;
    const nextForm = { ...form, [key]: !form[key] };
    setForm(nextForm);
    const saved = await handleSave(nextForm);
    if (!saved) {
      setForm(previousForm);
    }
  };

  const downloadSettingsSnapshot = (filename: string) => {
    const backupObj = {
      user: {
        ...user,
        name: form.displayName.trim() || user?.name || null,
      },
      settings: {
        ...settings,
        defaultCurrency: form.defaultCurrency,
        monthStartDay: form.monthStartDay,
        receiptReminders: form.receiptReminders,
        budgetAlerts: form.budgetAlerts,
        weeklyReport: form.weeklyReport,
        aiAssistEnabled: form.aiAssistEnabled,
      },
      localPreferences: {
        timeZone,
        theme,
        dateFormat,
        numberFormat,
        language,
        defaultDashboard,
        compactMode,
        goalUpdates,
        autoCategorize,
        recurringTransactions,
        defaultCategory,
        dataRetention
      }
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", filename);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  const handleExportData = () => {
    setError(null);
    downloadSettingsSnapshot('ai_accountant_settings_export.json');
  };

  const handleImportData = () => {
    setError(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith('.json')) {
        setError('Only JSON settings backups can be imported.');
        return;
      }

      file.text()
        .then(async (text) => {
          const parsed = JSON.parse(text) as {
            user?: RawUser;
            settings?: RawSettings;
            localPreferences?: Partial<Record<string, string | boolean>>;
          };
          const importedSettings = parsed.settings ? normalizeSettings(parsed.settings) : settings;
          const importedUser = parsed.user ? { ...fallbackUser(user), ...parsed.user } : user;
          const nextForm = formFrom(importedSettings, importedUser);

          setUser(importedUser);
          setForm(nextForm);

          const preferences = parsed.localPreferences || {};
          if (typeof preferences.timeZone === 'string') handleLocalChange('settings_timezone', preferences.timeZone, setTimeZone);
          if (typeof preferences.theme === 'string') handleLocalChange('settings_theme', preferences.theme, setTheme);
          if (typeof preferences.dateFormat === 'string') handleLocalChange('settings_date_format', preferences.dateFormat, setDateFormat);
          if (typeof preferences.numberFormat === 'string') handleLocalChange('settings_number_format', preferences.numberFormat, setNumberFormat);
          if (typeof preferences.language === 'string') handleLocalChange('settings_language', preferences.language, setLanguage);
          if (typeof preferences.defaultDashboard === 'string') handleLocalChange('settings_default_dashboard', preferences.defaultDashboard, setDefaultDashboard);
          if (typeof preferences.compactMode === 'boolean') handleLocalChange('settings_compact_mode', preferences.compactMode, setCompactMode);
          if (typeof preferences.goalUpdates === 'boolean') handleLocalChange('settings_goal_updates', preferences.goalUpdates, setGoalUpdates);
          if (typeof preferences.autoCategorize === 'boolean') handleLocalChange('settings_auto_categorize', preferences.autoCategorize, setAutoCategorize);
          if (typeof preferences.recurringTransactions === 'boolean') handleLocalChange('settings_recurring_transactions', preferences.recurringTransactions, setRecurringTransactions);
          if (typeof preferences.defaultCategory === 'string') handleLocalChange('settings_default_category', preferences.defaultCategory, setDefaultCategory);
          if (typeof preferences.dataRetention === 'string') handleLocalChange('settings_data_retention', preferences.dataRetention, setDataRetention);

          const saved = await handleSave(nextForm);
          if (!saved) {
            setForm(formFrom(settings, user));
          }
        })
        .catch(() => {
          setError('Could not import settings backup.');
        });
    };
    input.click();
  };

  const handleBackup = () => {
    setError(null);
    const backupDate = new Date().toLocaleDateString();
    setLastBackupDate(backupDate);
    localStorage.setItem('settings_last_backup', backupDate);
    downloadSettingsSnapshot('ai_accountant_settings_backup.json');
  };

  const handleDeleteAccount = () => {
    const confirmDelete = window.confirm("Are you absolutely sure you want to delete your account? This action is permanent and cannot be undone.");
    if (confirmDelete) {
      setError('Account deletion is not available yet.');
    }
  };

  const handleChatWithAI = () => {
    const chatInput = document.getElementById('ai-chat-input') || document.getElementById('ai-assistant-input');
    if (chatInput) {
      chatInput.focus();
    } else {
      // Navigate to dashboard where chat usually sits
      window.location.href = '/';
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 text-[#2F2925] font-sans">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[28px] font-black leading-tight tracking-tight text-[#2F2925]">Settings</h2>
          <p className="mt-0.5 text-sm font-semibold text-[#7B8491]">Manage your preferences and account settings</p>
        </div>
        
        {/* Right side search and notification icons */}
        <div className="flex items-center gap-3 self-end sm:self-center">
          {offlineMode && (
            <span className="rounded-full bg-[#FFF2E7] px-2.5 py-0.5 text-[11px] font-black text-[#9D4E2B]">
              Local Preview
            </span>
          )}
          <button
            type="button"
            onClick={handleChatWithAI}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EFE2D8] bg-white text-[#536073] hover:bg-[#FFF8F2] hover:text-[#2F2925] shadow-sm transition cursor-pointer"
            aria-label="Search"
          >
            <Search size={16} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            disabled
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[#EFE2D8] bg-white text-[#A8AEB8] shadow-sm transition cursor-not-allowed"
            aria-label="Notifications"
          >
            <Bell size={16} strokeWidth={2.5} />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#FF6F8F]" />
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-[16px] border border-[#F8C7CE] bg-[#FFF0F2] px-4 py-3 text-sm font-black text-[#C44B61] animate-fade-in">
          {error}
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        
        {/* Card 1: Profile */}
        <div className="bg-white border border-[#EFE2D8] rounded-[24px] p-6 shadow-[0_12px_28px_rgba(92,65,45,0.06)] flex flex-col justify-between min-h-[340px]">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#FFF0F2] text-[#FF6F8F]">
                <UserRound size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-[17px] font-black text-[#2F2925]">Profile</h3>
                <p className="text-[11px] font-semibold text-[#8B929C]">Manage your personal information</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              {/* Profile Avatar */}
              <div className="w-20 h-20 rounded-[20px] overflow-hidden shrink-0 border border-[#EFE2D8] bg-white shadow-inner">
                <img src={sarahAvatar} alt="Sarah's portrait" className="w-full h-full object-cover" />
              </div>

              {/* Profile Details List */}
              <div className="flex-grow border border-[#F1ECE7] rounded-2xl overflow-hidden bg-[#FAFAF9] shadow-sm">
                <div className="grid grid-cols-[85px_1fr] border-b border-[#F1ECE7]">
                  <div className="px-3.5 py-2.5 text-xs font-extrabold text-[#7B8491] border-r border-[#F1ECE7] flex items-center bg-[#FAF8F5] select-none">Full Name</div>
                  <div className="px-3.5 py-2.5 text-xs font-black text-[#2F2925] flex items-center bg-white">
                    {isEditingProfile ? (
                      <input
                        type="text"
                        aria-label="Display Name"
                        value={form.displayName}
                        onChange={(e) => setForm(prev => ({ ...prev, displayName: e.target.value }))}
                        className="w-full bg-transparent border-none outline-none focus:ring-0 text-xs font-black text-[#2F2925] p-0"
                      />
                    ) : (
                      form.displayName || user?.name || 'Sarah'
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-[85px_1fr] border-b border-[#F1ECE7]">
                  <div className="px-3.5 py-2.5 text-xs font-extrabold text-[#7B8491] border-r border-[#F1ECE7] flex items-center bg-[#FAF8F5] select-none">Email</div>
                  <div className="px-3.5 py-2.5 text-xs font-semibold text-[#7B8491] flex items-center bg-[#FAF9F6]">
                    {user?.email || 'sarah@example.com'}
                  </div>
                </div>

                <div className="grid grid-cols-[85px_1fr] border-b border-[#F1ECE7]">
                  <div className="px-3.5 py-2.5 text-xs font-extrabold text-[#7B8491] border-r border-[#F1ECE7] flex items-center bg-[#FAF8F5] select-none">Currency</div>
                  <div className="px-3.5 py-2.5 text-xs font-black text-[#2F2925] flex items-center bg-white">
                    {isEditingProfile ? (
                      <select
                        aria-label="Default Currency"
                        value={form.defaultCurrency}
                        onChange={(e) => setForm(prev => ({ ...prev, defaultCurrency: e.target.value }))}
                        className="w-full bg-transparent border-none outline-none focus:ring-0 text-xs font-black text-[#2F2925] p-0 cursor-pointer appearance-none"
                      >
                        {CURRENCY_OPTIONS.map(c => (
                          <option key={c.code} value={c.code}>{c.label}</option>
                        ))}
                      </select>
                    ) : (
                      CURRENCY_OPTIONS.find(c => c.code === form.defaultCurrency)?.label || form.defaultCurrency
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-[85px_1fr]">
                  <div className="px-3.5 py-2.5 text-xs font-extrabold text-[#7B8491] border-r border-[#F1ECE7] flex items-center bg-[#FAF8F5] select-none">Time Zone</div>
                  <div className="px-3.5 py-2.5 text-xs font-black text-[#2F2925] flex items-center bg-white">
                    {isEditingProfile ? (
                      <select
                        aria-label="Time Zone"
                        value={timeZone}
                        onChange={(e) => handleLocalChange('settings_timezone', e.target.value, setTimeZone)}
                        className="w-full bg-transparent border-none outline-none focus:ring-0 text-xs font-black text-[#2F2925] p-0 cursor-pointer appearance-none"
                      >
                        {TIMEZONES.map(tz => (
                          <option key={tz} value={tz}>{tz}</option>
                        ))}
                      </select>
                    ) : (
                      timeZone
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={toggleEditProfile}
              disabled={savingSettings}
              className={`w-fit font-black text-xs px-4.5 py-2.5 rounded-xl transition duration-150 shadow-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                isEditingProfile 
                  ? 'bg-gradient-to-r from-[#168B5E] to-[#1aa16d] hover:translate-y-[-1px] text-white'
                  : 'bg-[#FF6F8F] hover:bg-[#FF5B7F] hover:translate-y-[-1px] text-white shadow-[0_8px_18px_rgba(255,111,143,0.2)]'
              }`}
            >
              {savingSettings && isEditingProfile ? 'Saving...' : isEditingProfile ? 'Save Profile' : 'Edit Profile'}
            </button>
          </div>
        </div>

        {/* Card 2: Preferences */}
        <div className="bg-white border border-[#EFE2D8] rounded-[24px] p-6 shadow-[0_12px_28px_rgba(92,65,45,0.06)] flex flex-col justify-between min-h-[340px]">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#FFF0F2] text-[#FF6F8F]">
                <Sliders size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-[17px] font-black text-[#2F2925]">Preferences</h3>
                <p className="text-[11px] font-semibold text-[#8B929C]">Customize your app experience</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {/* Theme Dropdown */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#4E3629]">
                  <Sun size={15} className="text-[#8B929C]" />
                  Theme
                </div>
                <select
                  aria-label="Theme preference"
                  value={theme}
                  onChange={(e) => handleLocalChange('settings_theme', e.target.value, setTheme)}
                  className="bg-white border border-[#EFE2D8] rounded-xl px-3 py-1.5 text-xs font-black text-[#2F2925] outline-none shadow-sm focus:ring-2 focus:ring-[#FFD1DC]/40 cursor-pointer w-40"
                >
                  {THEMES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Date Format Dropdown */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#4E3629]">
                  <Calendar size={15} className="text-[#8B929C]" />
                  Date Format
                </div>
                <select
                  aria-label="Date format preference"
                  value={dateFormat}
                  onChange={(e) => handleLocalChange('settings_date_format', e.target.value, setDateFormat)}
                  className="bg-white border border-[#EFE2D8] rounded-xl px-3 py-1.5 text-xs font-black text-[#2F2925] outline-none shadow-sm focus:ring-2 focus:ring-[#FFD1DC]/40 cursor-pointer w-40"
                >
                  {DATE_FORMATS.map(df => (
                    <option key={df} value={df}>{df}</option>
                  ))}
                </select>
              </div>

              {/* Number Format Dropdown */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#4E3629]">
                  <SettingsIcon size={15} className="text-[#8B929C]" />
                  Number Format
                </div>
                <select
                  aria-label="Number format preference"
                  value={numberFormat}
                  onChange={(e) => handleLocalChange('settings_number_format', e.target.value, setNumberFormat)}
                  className="bg-white border border-[#EFE2D8] rounded-xl px-3 py-1.5 text-xs font-black text-[#2F2925] outline-none shadow-sm focus:ring-2 focus:ring-[#FFD1DC]/40 cursor-pointer w-40"
                >
                  {NUMBER_FORMATS.map(nf => (
                    <option key={nf} value={nf}>{nf}</option>
                  ))}
                </select>
              </div>

              {/* Language Dropdown */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#4E3629]">
                  <Globe size={15} className="text-[#8B929C]" />
                  Language
                </div>
                <select
                  aria-label="Language preference"
                  value={language}
                  onChange={(e) => handleLocalChange('settings_language', e.target.value, setLanguage)}
                  className="bg-white border border-[#EFE2D8] rounded-xl px-3 py-1.5 text-xs font-black text-[#2F2925] outline-none shadow-sm focus:ring-2 focus:ring-[#FFD1DC]/40 cursor-pointer w-40"
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>

              {/* Default Dashboard Dropdown */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#4E3629]">
                  <FileText size={15} className="text-[#8B929C]" />
                  Default Dashboard
                </div>
                <select
                  aria-label="Default dashboard preference"
                  value={defaultDashboard}
                  onChange={(e) => handleLocalChange('settings_default_dashboard', e.target.value, setDefaultDashboard)}
                  className="bg-white border border-[#EFE2D8] rounded-xl px-3 py-1.5 text-xs font-black text-[#2F2925] outline-none shadow-sm focus:ring-2 focus:ring-[#FFD1DC]/40 cursor-pointer w-40"
                >
                  {DASHBOARDS.map(db => (
                    <option key={db} value={db}>{db}</option>
                  ))}
                </select>
              </div>

              {/* Compact Mode Toggle */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#4E3629]">
                    <Laptop size={15} className="text-[#8B929C]" />
                    Compact Mode
                  </div>
                  <span className="text-[10px] text-[#8B929C] font-semibold mt-0.5">Show more data in less space</span>
                </div>
                <ToggleSwitch
                  label="Compact mode"
                  checked={compactMode}
                  onClick={() => handleLocalChange('settings_compact_mode', !compactMode, setCompactMode)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Notifications */}
        <div className="bg-white border border-[#EFE2D8] rounded-[24px] p-6 shadow-[0_12px_28px_rgba(92,65,45,0.06)] flex flex-col justify-between min-h-[340px]">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#FFF0F2] text-[#FF6F8F]">
                <Bell size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-[17px] font-black text-[#2F2925]">Notifications</h3>
                <p className="text-[11px] font-semibold text-[#8B929C]">Manage your notification preferences</p>
              </div>
            </div>

            <div className="flex flex-col gap-3.5">
              {/* Row 1: Transaction Alerts */}
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#FFF2E7] text-[#FF7F96]">
                    <FileText size={14} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#2F2925]">Transaction Alerts</h4>
                    <p className="text-[10px] text-[#8B929C] font-semibold mt-0.5">Get notified about new transactions</p>
                  </div>
                </div>
                <ToggleSwitch
                  label="Transaction Alerts"
                  checked={form.receiptReminders}
                  disabled={savingSettings}
                  onClick={() => toggleBackendSwitch('receiptReminders')}
                />
              </div>

              {/* Row 2: Budget Alerts */}
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#FFF2E7] text-[#FF7F96]">
                    <CreditCard size={14} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#2F2925]">Budget Alerts</h4>
                    <p className="text-[10px] text-[#8B929C] font-semibold mt-0.5">Get notified when budget limits are approached</p>
                  </div>
                </div>
                <ToggleSwitch
                  label="Budget Alerts"
                  checked={form.budgetAlerts}
                  disabled={savingSettings}
                  onClick={() => toggleBackendSwitch('budgetAlerts')}
                />
              </div>

              {/* Row 3: Goal Updates */}
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#FFF2E7] text-[#FF7F96]">
                    <Target size={14} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#2F2925]">Goal Updates</h4>
                    <p className="text-[10px] text-[#8B929C] font-semibold mt-0.5">Receive updates on goal progress</p>
                  </div>
                </div>
                <ToggleSwitch
                  label="Goal Updates"
                  checked={goalUpdates}
                  onClick={() => handleLocalChange('settings_goal_updates', !goalUpdates, setGoalUpdates)}
                />
              </div>

              {/* Row 4: Report Ready */}
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#FFF2E7] text-[#FF7F96]">
                    <FileBarChart size={14} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#2F2925]">Report Ready</h4>
                    <p className="text-[10px] text-[#8B929C] font-semibold mt-0.5">Get notified when reports are ready</p>
                  </div>
                </div>
                <ToggleSwitch
                  label="Report Ready"
                  checked={form.weeklyReport}
                  disabled={savingSettings}
                  onClick={() => toggleBackendSwitch('weeklyReport')}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Account & Security */}
        <div className="bg-white border border-[#EFE2D8] rounded-[24px] p-6 shadow-[0_12px_28px_rgba(92,65,45,0.06)] flex flex-col justify-between min-h-[340px]">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#FFF0F2] text-[#FF6F8F]">
                <Shield size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-[17px] font-black text-[#2F2925]">Account & Security</h3>
                <p className="text-[11px] font-semibold text-[#8B929C]">Manage your account security</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {/* Row 1: Change Password */}
              <button
                type="button"
                disabled
                className="flex w-full cursor-not-allowed items-center justify-between rounded-xl px-2 py-1 text-left opacity-60 transition"
              >
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#FFF2E7] text-[#FF7F96] mt-0.5">
                    <Lock size={14} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#2F2925]">Change Password</h4>
                    <p className="text-[10px] text-[#8B929C] font-semibold">Update your password</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-[#8B929C]" />
              </button>

              {/* Row 2: 2FA */}
              <button
                type="button"
                disabled
                className="flex w-full cursor-not-allowed items-center justify-between rounded-xl px-2 py-1 text-left opacity-60 transition"
              >
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#FFF2E7] text-[#FF7F96] mt-0.5">
                    <ShieldCheck size={14} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#2F2925]">Two-Factor Authentication</h4>
                    <p className="text-[10px] text-[#8B929C] font-semibold">Add an extra layer of security</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-black text-[#FF6F8F] bg-[#FFF0F2] px-2 py-0.5 rounded-full select-none">Off</span>
                  <ChevronRight size={16} className="text-[#8B929C]" />
                </div>
              </button>

              {/* Row 3: Active Sessions */}
              <button
                type="button"
                disabled
                className="flex w-full cursor-not-allowed items-center justify-between rounded-xl px-2 py-1 text-left opacity-60 transition"
              >
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#FFF2E7] text-[#FF7F96] mt-0.5">
                    <Monitor size={14} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#2F2925]">Active Sessions</h4>
                    <p className="text-[10px] text-[#8B929C] font-semibold">Manage your active sessions</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold text-[#8B929C]">3 sessions</span>
                  <ChevronRight size={16} className="text-[#8B929C]" />
                </div>
              </button>

              {/* Row 4: Delete Account */}
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="flex items-center justify-between py-1 hover:bg-red-50/50 rounded-xl px-2 -mx-2 transition cursor-pointer text-left w-full"
              >
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-red-50 text-[#FF6F8F] mt-0.5">
                    <Trash2 size={14} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#FF5B6F]">Delete Account</h4>
                    <p className="text-[10px] text-[#FF8A9B] font-semibold">Permanently delete your account</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-[#FF6F8F]" />
              </button>
            </div>
          </div>
        </div>

        {/* Card 5: Data & Privacy */}
        <div className="bg-white border border-[#EFE2D8] rounded-[24px] p-6 shadow-[0_12px_28px_rgba(92,65,45,0.06)] flex flex-col justify-between min-h-[340px]">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#FFF0F2] text-[#FF6F8F]">
                <Database size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-[17px] font-black text-[#2F2925]">Data & Privacy</h3>
                <p className="text-[11px] font-semibold text-[#8B929C]">Manage your data and privacy settings</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {/* Row 1: Export Data */}
              <button
                type="button"
                onClick={handleExportData}
                className="flex items-center justify-between py-1 hover:bg-[#FAF8F5] rounded-xl px-2 -mx-2 transition cursor-pointer text-left w-full"
              >
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#FFF2E7] text-[#FF7F96] mt-0.5">
                    <Download size={14} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#2F2925]">Export Data</h4>
                    <p className="text-[10px] text-[#8B929C] font-semibold">Download your data</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-[#8B929C]" />
              </button>

              {/* Row 2: Import Data */}
              <button
                type="button"
                onClick={handleImportData}
                className="flex items-center justify-between py-1 hover:bg-[#FAF8F5] rounded-xl px-2 -mx-2 transition cursor-pointer text-left w-full"
              >
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#FFF2E7] text-[#FF7F96] mt-0.5">
                    <Upload size={14} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#2F2925]">Import Data</h4>
                    <p className="text-[10px] text-[#8B929C] font-semibold">Import settings backup</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-[#8B929C]" />
              </button>

              {/* Row 3: Data Backup */}
              <button
                type="button"
                onClick={handleBackup}
                className="flex items-center justify-between py-1 hover:bg-[#FAF8F5] rounded-xl px-2 -mx-2 transition cursor-pointer text-left w-full"
              >
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#FFF2E7] text-[#FF7F96] mt-0.5">
                    <Cloud size={14} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#2F2925]">Data Backup</h4>
                    <p className="text-[10px] text-[#8B929C] font-semibold">Last backup: {lastBackupDate}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-[#8B929C]" />
              </button>

              {/* Row 4: Privacy Policy */}
              <a
                href="https://example.com/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between py-1 hover:bg-[#FAF8F5] rounded-xl px-2 -mx-2 transition cursor-pointer text-left w-full"
              >
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#FFF2E7] text-[#FF7F96] mt-0.5">
                    <FileText size={14} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#2F2925]">Privacy Policy</h4>
                    <p className="text-[10px] text-[#8B929C] font-semibold">Read our privacy policy</p>
                  </div>
                </div>
                <ExternalLink size={14} className="text-[#8B929C] mr-0.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Card 6: App Settings */}
        <div className="bg-white border border-[#EFE2D8] rounded-[24px] p-6 shadow-[0_12px_28px_rgba(92,65,45,0.06)] flex flex-col justify-between min-h-[340px]">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#FFF0F2] text-[#FF6F8F]">
                <SettingsIcon size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-[17px] font-black text-[#2F2925]">App Settings</h3>
                <p className="text-[11px] font-semibold text-[#8B929C]">Configure app behavior</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {/* Row 1: Auto-categorize Switch */}
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-2 text-xs font-bold text-[#4E3629]">
                  <Tag size={15} className="text-[#8B929C] mt-0.5 shrink-0" />
                  <div>
                    <h4 className="leading-tight">Auto-categorize Transactions</h4>
                    <p className="text-[9px] text-[#8B929C] font-semibold mt-0.5">Automatically categorize transactions</p>
                  </div>
                </div>
                <ToggleSwitch
                  label="Auto-categorize Transactions"
                  checked={autoCategorize}
                  onClick={() => handleLocalChange('settings_auto_categorize', !autoCategorize, setAutoCategorize)}
                />
              </div>

              {/* Row 2: Recurring Switch */}
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-2 text-xs font-bold text-[#4E3629]">
                  <RefreshCw size={14} className="text-[#8B929C] mt-0.5 shrink-0" />
                  <div>
                    <h4 className="leading-tight">Recurring Transactions</h4>
                    <p className="text-[9px] text-[#8B929C] font-semibold mt-0.5">Enable recurring transactions</p>
                  </div>
                </div>
                <ToggleSwitch
                  label="Recurring Transactions"
                  checked={recurringTransactions}
                  onClick={() => handleLocalChange('settings_recurring_transactions', !recurringTransactions, setRecurringTransactions)}
                />
              </div>

              {/* Row 3: Default Category */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#4E3629]">
                  <Folder size={15} className="text-[#8B929C]" />
                  Default Category
                </div>
                <select
                  aria-label="Default category"
                  value={defaultCategory}
                  onChange={(e) => handleLocalChange('settings_default_category', e.target.value, setDefaultCategory)}
                  className="bg-white border border-[#EFE2D8] rounded-xl px-2.5 py-1.5 text-xs font-black text-[#2F2925] outline-none shadow-sm focus:ring-2 focus:ring-[#FFD1DC]/40 cursor-pointer w-32"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Row 4: Data Retention */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#4E3629]">
                  <Clock size={15} className="text-[#8B929C]" />
                  Data Retention
                </div>
                <select
                  aria-label="Data retention"
                  value={dataRetention}
                  onChange={(e) => handleLocalChange('settings_data_retention', e.target.value, setDataRetention)}
                  className="bg-white border border-[#EFE2D8] rounded-xl px-2.5 py-1.5 text-xs font-black text-[#2F2925] outline-none shadow-sm focus:ring-2 focus:ring-[#FFD1DC]/40 cursor-pointer w-32"
                >
                  {RETENTIONS.map(ret => (
                    <option key={ret} value={ret}>{ret}</option>
                  ))}
                </select>
              </div>

              {/* Row 5: Month Start Day (Backend Synced) */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#4E3629]">
                  <Calendar size={15} className="text-[#8B929C]" />
                  Month Start Day
                </div>
                <select
                  aria-label="Month start day"
                  value={form.monthStartDay}
                  disabled={savingSettings}
                  onChange={async (e) => {
                    if (savingSettings) return;
                    const previousForm = form;
                    const val = Number(e.target.value);
                    const nextForm = { ...form, monthStartDay: val };
                    setForm(nextForm);
                    const saved = await handleSave(nextForm);
                    if (!saved) {
                      setForm(previousForm);
                    }
                  }}
                  className="bg-white border border-[#EFE2D8] rounded-xl px-2.5 py-1.5 text-xs font-black text-[#2F2925] outline-none shadow-sm focus:ring-2 focus:ring-[#FFD1DC]/40 cursor-pointer w-32 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
                    <option key={day} value={day}>
                      Day {day}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <AiProviderSettingsCard
          onAiAssistChange={(enabled) =>
            setForm((current) => (current.aiAssistEnabled === enabled ? current : { ...current, aiAssistEnabled: enabled }))
          }
        />
      </div>

      {/* Bottom Full Width Card: Need Help? */}
      <div className="bg-[#FFFDFB] border border-[#EFE2D8] rounded-[24px] p-6 shadow-[0_12px_28px_rgba(92,65,45,0.05)] flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between w-full">
        <div className="flex items-center gap-4.5">
          <div className="h-16 w-16 shrink-0 rounded-2xl bg-[#FFF4E8] border border-[#F0DFD0] p-1.5 shadow-sm">
            <CuteSticker name="waving-cat" className="h-full w-full" title="Need help assistant cat" />
          </div>
          <div>
            <h3 className="text-base font-black text-[#2F2925]">Need Help?</h3>
            <p className="text-xs font-semibold text-[#7B8491] mt-0.5">Our AI Assistant is here to help you with any questions about settings or your account.</p>
          </div>
        </div>
        <div>
          <button
            type="button"
            onClick={handleChatWithAI}
            className="w-full sm:w-fit font-black text-xs px-6 py-3 rounded-full bg-[#FFF2F4] text-[#FF5B6F] hover:bg-[#FFE5E9] border border-[#FFE0E4] transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <MessageSquare size={14} />
            Chat with AI
          </button>
        </div>
      </div>
    </div>
  );
};
