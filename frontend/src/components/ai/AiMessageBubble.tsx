import { CuteSticker } from '../CuteStickers';
import { AiDraftCard } from './AiDraftCard';
import { useDraftStore } from '../../store/useDraftStore';
import type { AiChatMessage } from '../../store/useAiChatStore';

interface AiMessageBubbleProps {
  message: AiChatMessage;
}

export const AiMessageBubble = ({ message }: AiMessageBubbleProps) => {
  const draftIds = message.draftIds || [];
  const allDrafts = useDraftStore((state) => state.drafts);
  const drafts = allDrafts.filter((draft) => draftIds.includes(draft.id));
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <CuteSticker
          name="waving-cat"
          className="mt-1 h-9 w-9 shrink-0 rounded-full border border-[#F0D9C7] bg-[#FFF1E2] p-1 shadow-[0_8px_18px_rgba(92,65,45,0.08)]"
          title="Cat AI"
        />
      )}

      <div className={`max-w-[86%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
        <div
          className={`rounded-[20px] px-4 py-3 text-sm font-bold leading-relaxed shadow-[0_8px_20px_rgba(92,65,45,0.08)] ${
            isUser
              ? 'rounded-br-md bg-[#FF8A9B] text-white'
              : message.error
                ? 'rounded-bl-md border border-red-200 bg-red-50 text-red-600'
                : 'rounded-bl-md border border-[#EFE2D8] bg-[#FFFDFB] text-[#4E3629]'
          }`}
        >
          {message.imagePreviewUrl && (
            <img
              src={message.imagePreviewUrl}
              alt={message.filename || 'Uploaded receipt'}
              className="mb-2 max-h-44 w-full rounded-[14px] object-cover"
            />
          )}
          {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
          {message.filename && (
            <p className={`mt-1 truncate text-[11px] font-black ${isUser ? 'text-white/75' : 'text-[#8B929C]'}`}>
              {message.filename}
            </p>
          )}
        </div>

        {message.warnings && message.warnings.length > 0 && (
          <div className="rounded-[14px] border border-[#F3D8A9] bg-[#FFF8E8] px-3 py-2 text-[11px] font-bold leading-relaxed text-[#8A5B16]">
            {message.warnings.slice(0, 2).map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}

        {draftIds.length > 0 && drafts.length === 0 && (
          <p className="rounded-full bg-[#EAFBF1] px-3 py-1 text-[11px] font-black text-[#3D8C5A]">
            草稿已经处理完毕喵~
          </p>
        )}

        {drafts.length > 0 && (
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
            {drafts.map((draft, index) => (
              <AiDraftCard key={draft.id} draft={draft} index={index} compact />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
