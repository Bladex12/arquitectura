import { api, unwrapResults } from './api';

// Matches game_sessions/serializers.py's TokenTransactionSerializer.
// Append-only ledger item; `id` is sourced from the item's own SK
// (safe here -- unlike TeamActivityProgress/TeamBubbleMap/PeerEvaluation,
// this item is never addressed by a detail-route URL built from `id`).
export interface TokenTransaction {
  id: string;
  team: string;
  team_name: string | null;
  game_session: string;
  game_session_room_code: string;
  session_stage?: string | null;
  stage_name: string | null;
  stage_number: number | null;
  amount: number;
  source_type: string;
  source_id?: string | null;
  reason?: string | null;
  awarded_by?: string | null;
  awarded_by_name: string | null;
  created_at: string;
}

export const tokenTransactionsAPI = {
  list: async (params?: Record<string, any>): Promise<TokenTransaction[]> => {
    const response = await api.get('/sessions/token-transactions/', { params });
    return unwrapResults<TokenTransaction[]>(response.data);
  },
};











