export type ToggleSwitchProps = {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onClick: () => void | Promise<void>;
};

export const ToggleSwitch = ({ label, checked, disabled = false, onClick }: ToggleSwitchProps) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={checked}
    disabled={disabled}
    onClick={() => {
      void onClick();
    }}
    className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200 ease-out cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
      checked ? 'border-[#FF6F8F] bg-[#FF6F8F]' : 'border-[#D6C8BE] bg-[#E9DED5]'
    }`}
  >
    <span
      className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-[0_3px_8px_rgba(92,65,45,0.18)] transition-transform duration-200 ease-out ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
      aria-hidden="true"
    />
  </button>
);
