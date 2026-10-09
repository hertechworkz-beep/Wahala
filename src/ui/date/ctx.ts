import type { EscapeOutcome, SceneSpec } from '../../engine/scene';
import type { ChoiceResult, PortraitLook, RunState, SceneEvent } from '../../engine/types';
import type { Worn } from './Figure';

/** What every step of the first date gets from the orchestrator. */
export interface DateCtx {
  scene: SceneSpec;
  run: RunState;
  feminine: boolean;
  look: PortraitLook; // the player's look with tonight's outfit and hair applied
  worn: Worn;
  seat: string;
  phoneOut: boolean;
  escape?: EscapeOutcome;
  title: string; // how Musa addresses you
  /** Commit a played moment: meters move, money pops, the HUD reacts. */
  play: (ev: SceneEvent) => ChoiceResult | undefined;
  /** Move to the next step. */
  next: () => void;
}
