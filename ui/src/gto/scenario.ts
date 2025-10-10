// ui/src/gto/scenario.ts

export type HandLike = {
  bigBlind: number;
  players: Record<
    string,
    {
      id?: string;
      name: string;
      seat: number;
      stack: number;
      hero?: boolean;
      position?: string; // "UTG" | "MP" | "HJ" | "CO" | "BTN" | "SB" | "BB" | "UTG+1" ...
      cards?: string[];
      visualSeat?: number;
    }
  >;
  actions: {
    preflop?: Array<{
      player: string;
      action: "posts" | "bets" | "calls" | "raises" | "folds" | "checks";
      amount?: number;
      raw?: string;
    }>;
    flop?: Array<any>;
    turn?: Array<any>;
    river?: Array<any>;
  };
  button?: number;
  anteTotal?: number;
  antes?: Array<{ player: string; amount: number }>;
  board?: string[];
  winners?: Array<{ player: string; amount: number }>;
  collected?: Array<{ player: string; amount: number }>;
  results?: Array<{ player: string; amount: number; result: string }>;
  summaryLines?: string[] | string;
  summary?: string[] | string;
  rawSummary?: string[] | string;
  raw?: string[] | string;
};
