import type { Server } from 'socket.io';
export declare function initConfigEvents(io: Server): void;
export type ConfigType = 'teams' | 'questions' | 'evaluationItems' | 'tiebreakQuestions' | 'phases' | 'jurors' | 'partners' | 'suspensePhrases' | 'presentation' | 'bracket';
export declare function emitConfigUpdated(type: ConfigType, championship?: string | null): void;
export declare function broadcastLiveState(): void;
//# sourceMappingURL=configEvents.d.ts.map