declare module 'pokersolver' {
  export class Hand {
    constructor(cards: string[]);

    static solve(hands: string[]): Hand;

    static winners(hands: Hand[]): Hand[];

    rank: number;
    cards: Array<{ value: string; suit: string }>;
    name: string;
    descr: string;

    toString(): string;
  }
}
