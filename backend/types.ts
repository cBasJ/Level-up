export interface Card { id: string; s: string; r: number }
export interface Play { player: number; cards: Card[] }
export interface Bid { player: number; choice: string; trump: string; strength: number; cards: Card[] }
export interface Member { id: string; name: string; ready: boolean; avatar?: number }
export interface Game {
  id: string;
  phase: 'dealing'|'bidding'|'bury'|'playing'|'throwing'|'review'|'over';
  level: number; trump: string|null; dealer: number; turn: number;
  hands: Card[][]; bottom: Card[]; deck: Card[]; dealIndex: number;
  plays: Play[]; lastTrick: Play[]; publicCards: Card[]; voids: string[][];
  currentBid: Bid|null; score: number; trick: number; deadline: number;
  declared?: boolean[]; passed?: boolean[]; turnMs?: number;
  pending?: { player: number; cards: Card[] }; message: string; matchOver?: boolean;
}
export interface RoomSettings { startLevel:number; turnSeconds:number; maxRounds:number }
export interface Room { settings?: RoomSettings; code: string; revision: number; members: Member[]; levels: number[]; dealer: number; round: number; game: Game|null; updatedAt: number }
