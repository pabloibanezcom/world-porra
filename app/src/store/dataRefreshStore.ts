import { create } from 'zustand';

interface DataRefreshState {
  leaguesVersion: number;
  predictionsVersion: number;
  markLeaguesChanged: () => void;
  markPredictionsChanged: () => void;
}

export const useDataRefreshStore = create<DataRefreshState>((set) => ({
  leaguesVersion: 0,
  predictionsVersion: 0,
  markLeaguesChanged: () => set((state) => ({ leaguesVersion: state.leaguesVersion + 1 })),
  markPredictionsChanged: () => set((state) => ({ predictionsVersion: state.predictionsVersion + 1 })),
}));

export function markLeaguesChanged() {
  useDataRefreshStore.getState().markLeaguesChanged();
}

export function markPredictionsChanged() {
  useDataRefreshStore.getState().markPredictionsChanged();
}
