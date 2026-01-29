import React from 'react';

const TypingIndicator: React.FC = () => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'flex-start',
      marginBottom: 12,
      animation: 'fadeIn 0.3s ease-in-out'
    }}>
      <div style={{
        display: 'flex',
        gap: 4,
        padding: '10px 14px',
        backgroundColor: '#f0f0f0',
        borderRadius: 12,
        borderTopLeftRadius: 4,
        alignItems: 'center'
      }}>
        <div className="typing-dot" style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: '#999999',
          animation: 'bounce 1.4s infinite ease-in-out both',
          animationDelay: '0s'
        }} />
        <div className="typing-dot" style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: '#999999',
          animation: 'bounce 1.4s infinite ease-in-out both',
          animationDelay: '0.32s'
        }} />
        <div className="typing-dot" style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: '#999999',
          animation: 'bounce 1.4s infinite ease-in-out both',
          animationDelay: '0.64s'
        }} />
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default TypingIndicator;
