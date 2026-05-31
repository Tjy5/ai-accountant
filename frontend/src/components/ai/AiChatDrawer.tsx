import { useLocation, useNavigate } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
import { useAiChatStore } from '../../store/useAiChatStore';
import { useDraftStore } from '../../store/useDraftStore';

export const AiChatDrawer = () => {
  const isOpen = useAiChatStore((state) => state.isOpen);
  const isMinimized = useAiChatStore((state) => state.isMinimized);
  const open = useAiChatStore((state) => state.open);
  const drafts = useDraftStore((state) => state.drafts);
  const draftCount = drafts.length;
  const location = useLocation();
  const navigate = useNavigate();

  // On the dashboard, the chat is rendered inline inside the card component, so no floating button is shown
  if (location.pathname === '/') {
    return null;
  }

  if (!isOpen || isMinimized) {
    const handleOpen = () => {
      navigate('/');
      // Trigger open in store so the dashboard chat card unfolds automatically
      open();
    };

    return (
      <button
        type="button"
        onClick={handleOpen}
        className="fixed bottom-5 right-5 z-[70] flex h-14 w-14 items-center justify-center rounded-full border border-[#F0D9C7] bg-[#FFF1E2] text-[#4E3629] shadow-[0_18px_40px_rgba(92,65,45,0.22)] transition-transform hover:scale-105 cursor-pointer"
        aria-label="Open cat AI chat"
      >
        <PawPrint size={24} strokeWidth={2.7} />
        {draftCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-[#FF6F8F] px-1 text-xs font-black text-white">
            {draftCount}
          </span>
        )}
      </button>
    );
  }

  return null;
};
