import type { CSSProperties } from 'react';

import logoCat from '../assets/kawaii/ui-logo-cat.png';
import loginCat from '../assets/kawaii/ui-login-cat.png';
import hangingCat from '../assets/kawaii/ui-hanging-cat.png';
import transactionsCat from '../assets/kawaii/ui-transactions-cat.png';
import categoriesCat from '../assets/kawaii/ui-categories-cat.png';
import budgetsCat from '../assets/kawaii/ui-budgets-cat.png';
import wavingCat from '../assets/kawaii/ui-waving-cat.png';
import sprout from '../assets/kawaii/ui-sprout.png';
import moneyBag from '../assets/kawaii/ui-money-bag.png';
import shoppingBag from '../assets/kawaii/ui-shopping-bag.png';
import piggyBank from '../assets/kawaii/ui-piggy-bank.png';
import avatar from '../assets/kawaii/ui-user-avatar.png';

type StickerName =
  | 'logo-cat'
  | 'calculator-cat'
  | 'hanging-cat'
  | 'transactions-cat'
  | 'categories-cat'
  | 'budgets-cat'
  | 'waving-cat'
  | 'sprout'
  | 'money-bag'
  | 'shopping-bag'
  | 'piggy-bank'
  | 'avatar';

interface CuteStickerProps {
  name: StickerName;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

const stickers: Record<StickerName, string> = {
  'logo-cat': logoCat,
  'calculator-cat': loginCat,
  'hanging-cat': hangingCat,
  'transactions-cat': transactionsCat,
  'categories-cat': categoriesCat,
  'budgets-cat': budgetsCat,
  'waving-cat': wavingCat,
  sprout,
  'money-bag': moneyBag,
  'shopping-bag': shoppingBag,
  'piggy-bank': piggyBank,
  avatar,
};

export const CuteSticker = ({ name, className = '', style, title }: CuteStickerProps) => (
  <span className={`block ${className}`} style={style} title={title}>
    <img
      src={stickers[name]}
      alt={title || name}
      draggable={false}
      className="h-full w-full select-none object-contain"
    />
  </span>
);
