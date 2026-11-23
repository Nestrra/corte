import { create } from 'zustand';

interface FrontCardState {
  /** Card in front of the home carousel; null until the home shows one. */
  frontCardId: string | null;
  setFrontCardId: (id: string | null) => void;
}

/**
 * The card in front of the home carousel (spec 004 research.md R6; data-model.md → "Estado en la
 * app"). Memory only: when the app opens again the first card is in front. The center button reads
 * it to preselect the card; if it is no longer active the first active card is used.
 */
export const useFrontCardStore = create<FrontCardState>()((set) => ({
  frontCardId: null,
  setFrontCardId: (id) => set({ frontCardId: id }),
}));
