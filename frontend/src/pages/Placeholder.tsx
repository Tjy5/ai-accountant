import React from 'react';
import { Card } from '../components/Card';
import { CuteSticker } from '../components/CuteStickers';

interface PlaceholderProps {
  title: string;
}

export const Placeholder: React.FC<PlaceholderProps> = ({ title }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center text-[#4E3629]">
      <Card className="max-w-md w-full border-4 border-[#4E3629] rounded-[30px] p-8 bg-white shadow-md flex flex-col items-center gap-6">
        <div className="w-24 h-24 rounded-[28px] bg-[#FFF1E2] border border-[#F0D9C7] p-2 flex items-center justify-center animate-bounce">
          <CuteSticker name="logo-cat" className="w-full h-full" title="Cute Calico Cat Logo" />
        </div>
        <div>
          <h1 className="text-3xl font-black">{title}</h1>
          <p className="text-gray-500 font-bold mt-2">
            This cozy feature is currently being baked in the kitchen. Check back soon! 🧁 ✨
          </p>
        </div>
      </Card>
    </div>
  );
};
