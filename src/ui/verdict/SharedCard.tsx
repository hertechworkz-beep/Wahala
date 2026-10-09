import { ScaledCard } from './VerdictScreen';
import { VerdictCard } from './VerdictCard';
import type { CardData } from './payload';

export default function SharedCard({ c }: { c: CardData }) {
  return (
    <div className="overflow-hidden rounded-[22px] shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
      <ScaledCard width={360} height={640}>
        <VerdictCard c={c} url={location.href} />
      </ScaledCard>
    </div>
  );
}
