import type { OptionKey, PresentedItem, Reveal } from '@fom/core';
import { OPTION_KEYS } from '@fom/core';

export interface QuestionViewProps {
  item: PresentedItem;
  chosen: OptionKey | null;
  locked: boolean;
  reveal?: Reveal | null;
  onChoose: (k: OptionKey) => void;
  showMeta?: boolean;
}

export default function QuestionView({ item, chosen, locked, reveal, onChoose, showMeta }: QuestionViewProps) {
  return (
    <div>
      {showMeta && (
        <div className="mb-2 flex flex-wrap gap-2 text-xs">
          <span className="tag">{item.subdomain}</span>
          <span className="tag">{item.difficulty}</span>
          <span className="tag">{item.cognitiveLevel}</span>
          <span className="tag">{item.questionId}</span>
        </div>
      )}
      <p className="stem mb-5 whitespace-pre-line">{item.stem}</p>
      <div role="radiogroup" aria-label="Answer options" className="space-y-2">
        {OPTION_KEYS.map((k, i) => {
          const isChosen = chosen === k;
          let cls = 'option';
          if (reveal) {
            if (k === reveal.correct) cls += ' correct';
            else if (isChosen) cls += ' incorrect';
          }
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={isChosen}
              className={cls}
              disabled={locked}
              onClick={() => onChoose(k)}
              data-key={i + 1}
            >
              <span className="letter" aria-hidden="true">{k}</span>
              <span className="flex-1">{item.options[k]}</span>
              {reveal && k === reveal.correct && <span className="text-xs font-semibold text-good">Correct</span>}
              {reveal && isChosen && k !== reveal.correct && <span className="text-xs font-semibold text-critical">Your answer</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RevealPanel({ reveal, chosen }: { reveal: Reveal; chosen: OptionKey | null }) {
  const correct = chosen === reveal.correct;
  return (
    <div className="mt-5 space-y-4 rounded-md border border-line bg-surface-2 p-4 text-sm">
      <div className={`font-semibold ${correct ? 'text-good' : chosen ? 'text-critical' : ''}`}>
        {chosen ? (correct ? '✓ Correct.' : `✗ Incorrect — the keyed answer is ${reveal.correct}.`) : `Keyed answer: ${reveal.correct}.`}
      </div>
      <p>{reveal.explanation}</p>
      <div>
        <div className="mb-1 font-medium">Why the other options are wrong</div>
        <ul className="space-y-1">
          {(Object.keys(reveal.distractorExplanations) as OptionKey[]).sort().map((k) => (
            <li key={k} className={k === chosen ? 'font-medium' : ''}><span className="mr-1 inline-block w-5 font-semibold">{k}.</span>{reveal.distractorExplanations[k]}</li>
          ))}
        </ul>
      </div>
      {reveal.distinction && (
        <div className="rounded border border-accent bg-accent-soft p-3">
          <div className="font-medium">Explain the distinction: {reveal.distinction.between.join(' vs ')}</div>
          <p>{reveal.distinction.key}</p>
        </div>
      )}
      <div className="text-xs muted">
        <div><span className="font-medium">Objective:</span> {reveal.learningObjective}</div>
        <div><span className="font-medium">References:</span> {reveal.references.map((r) => (r.locator ? `${r.source} (${r.locator})` : r.source)).join('; ')}</div>
        <div><span className="font-medium">Concepts:</span> {reveal.concepts.join(', ')}</div>
      </div>
    </div>
  );
}
