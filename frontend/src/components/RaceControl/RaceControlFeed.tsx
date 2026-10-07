import { useRaceStore } from '../../store/useRaceStore.js';
import { clock } from '../../utils/format.js';

const FLAG_STYLE: Record<string, string> = {
  YELLOW: 'border-l-f1-yellow bg-f1-yellow/[0.08]',
  DOUBLE_YELLOW: 'border-l-f1-yellow bg-f1-yellow/[0.12]',
  RED: 'border-l-f1-red bg-f1-red/[0.1]',
  GREEN: 'border-l-f1-green bg-f1-green/[0.08]',
  CHEQUERED: 'border-l-white bg-white/[0.07]',
  BLUE: 'border-l-[#4A9FFF] bg-[#4A9FFF]/[0.08]',
};

export function RaceControlFeed({ limit = 16 }: { limit?: number }) {
  const messages = useRaceStore((s) => s.messages);

  return (
    <section className="glass flex min-h-0 flex-col overflow-hidden rounded-xl" aria-label="Race control">
      <header className="border-b border-f1-border px-3 py-2">
        <span className="label">Race control</span>
      </header>

      <ol className="min-h-0 flex-1 overflow-y-auto p-2" aria-live="polite">
        {messages.slice(0, limit).map((m, i) => (
          <li
            key={`${m.tMs}-${i}`}
            className={`mb-1.5 flex gap-2 rounded-lg border-l-2 border-l-f1-dimmer bg-white/[0.035] px-2 py-1.5 ${
              m.flag ? FLAG_STYLE[m.flag.toUpperCase()] ?? '' : ''
            }`}
          >
            <time className="shrink-0 pt-px font-mono text-[9.5px] text-f1-dimmer">
              {clock(m.tMs).slice(3)}
            </time>
            <p className="m-0 text-[10.6px] leading-relaxed text-f1-text/80">{m.message}</p>
          </li>
        ))}

        {messages.length === 0 && (
          <li className="p-4 text-center text-[11px] text-f1-dimmer">No messages yet.</li>
        )}
      </ol>
    </section>
  );
}
