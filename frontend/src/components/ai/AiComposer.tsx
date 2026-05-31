import { useRef, useState } from 'react';
import { Camera, Loader2, Send } from 'lucide-react';
import { useAiChatStore } from '../../store/useAiChatStore';

export const AiComposer = () => {
  const pending = useAiChatStore((state) => state.pending);
  const sendText = useAiChatStore((state) => state.sendText);
  const sendImage = useAiChatStore((state) => state.sendImage);

  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    const nextText = text.trim();
    if (!nextText || pending) return;
    setText('');
    await sendText(nextText);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    const note = text.trim();
    setText('');
    event.currentTarget.value = '';
    await sendImage(file, note ? { text: note } : undefined);
  };

  return (
    <div className="border-t border-[#EFE2D8] bg-[#FFFDFB] p-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-end gap-2 rounded-[22px] border border-[#EFE2D8] bg-[#FFF8F3] px-3 py-2 shadow-inner">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={pending}
          className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#6F7785] transition-colors hover:bg-white hover:text-[#4E3629] disabled:opacity-50 cursor-pointer"
          aria-label="Upload receipt image"
          title="Upload receipt image"
        >
          <Camera size={19} strokeWidth={2.35} />
        </button>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void handleSubmit();
            }
          }}
          disabled={pending}
          rows={1}
          placeholder='试试：\"午餐 38\"，或上传账单图片喵~'
          className="max-h-28 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm font-bold leading-6 text-[#4E3629] outline-none placeholder:text-[#A7A0A0] disabled:opacity-60"
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || !text.trim()}
          className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF8A9B] text-white shadow-[0_8px_18px_rgba(255,127,150,0.28)] transition-all hover:bg-[#FF6F8F] disabled:opacity-50 cursor-pointer"
          aria-label="Send message"
        >
          {pending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={15} className="translate-x-[-1px] translate-y-[1px]" strokeWidth={3} />
          )}
        </button>
      </div>
    </div>
  );
};
