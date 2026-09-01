/**
 * STAY IN TOUCH, and LEAVE A REVIEW.
 *
 * Both post to /api/feedback and are stored in SQLite on the Fly volume, which
 * is the one durable thing the server has (server/feedback.ts explains why it
 * is the exception to this project's no-database rule). Nothing here shows the
 * owner's address: the submissions go to a private admin page, not to a mailbox
 * the whole internet can read off the page source.
 *
 * The two forms share `Field`, `Submitted` and the submit/error handling below,
 * because the only real difference between them is which inputs are required.
 */

import { useState } from 'react';
import { submitFeedback } from './feedbackApi';

type State = { k: 'idle' } | { k: 'sending' } | { k: 'done' } | { k: 'error'; message: string };

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label className="contact-label" htmlFor={id}>
        {label}
        {hint && <span className="field-hint"> {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Submitted({ title, line, onClose }: { title: string; line: string; onClose: () => void }) {
  return (
    <>
      <h2>{title}</h2>
      <p>{line}</p>
      <div className="row">
        <button className="primary" onClick={onClose}>
          Close
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ stay in touch */

export function StayInTouch({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>({ k: 'idle' });

  const canSend = email.trim().length > 0 && state.k !== 'sending';

  async function send() {
    setState({ k: 'sending' });
    try {
      await submitFeedback({ kind: 'signup', name: name.trim(), email: email.trim() });
      setState({ k: 'done' });
    } catch (e) {
      setState({ k: 'error', message: e instanceof Error ? e.message : 'That did not send.' });
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal contact-modal" onClick={(e) => e.stopPropagation()}>
        {state.k === 'done' ? (
          <Submitted
            title="You are on the list"
            line="You will hear when there is something worth hearing about, and nothing in between."
            onClose={onClose}
          />
        ) : (
          <>
            <h2>Stay in touch</h2>
            <p>
              Laundromat is a board game in development. Leave your details and you will hear
              when there is something worth hearing about — a playtest, a print run. No
              newsletter, no schedule.
            </p>

            <Field id="touch-name" label="Your name">
              <input
                id="touch-name"
                className="contact-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder="Kai"
              />
            </Field>

            <Field id="touch-email" label="Your email">
              <input
                id="touch-email"
                className="contact-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </Field>

            {state.k === 'error' && (
              <p className="contact-error" role="alert">
                {state.message}
              </p>
            )}

            <div className="row">
              <button className="primary" disabled={!canSend} onClick={send}>
                {state.k === 'sending' ? 'Sending…' : 'Send'}
              </button>
              <button onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- the review */

/** Steam shows a word, not a number, and the word is what people remember. */
const VERDICT: Record<number, string> = {
  1: 'Not for me',
  2: 'Mostly negative',
  3: 'Mixed',
  4: 'Positive',
  5: 'Very positive',
};

export function LeaveReview({ onClose }: { onClose: () => void }) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>({ k: 'idle' });
  const shown = hover || stars;

  const canSend = stars > 0 && state.k !== 'sending';

  async function send() {
    setState({ k: 'sending' });
    try {
      await submitFeedback({
        kind: 'review',
        stars,
        comment: comment.trim(),
        name: name.trim(),
        email: email.trim(),
      });
      setState({ k: 'done' });
    } catch (e) {
      setState({ k: 'error', message: e instanceof Error ? e.message : 'That did not send.' });
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal contact-modal" onClick={(e) => e.stopPropagation()}>
        {state.k === 'done' ? (
          <Submitted
            title="Thank you"
            line="Your review is in. An honest reaction while the game is still being designed is worth a great deal."
            onClose={onClose}
          />
        ) : (
          <>
            <h2>Leave a review</h2>
            <p>
              The game is still being designed, so an honest reaction is worth more than a kind
              one.
            </p>

            <div
              className="stars"
              role="radiogroup"
              aria-label="Rating out of five"
              onMouseLeave={() => setHover(0)}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={stars === n}
                  aria-label={`${n} out of 5 — ${VERDICT[n]}`}
                  className={`star${n <= shown ? ' on' : ''}`}
                  onMouseEnter={() => setHover(n)}
                  onFocus={() => setHover(n)}
                  onBlur={() => setHover(0)}
                  onClick={() => setStars(n)}
                >
                  ★
                </button>
              ))}
              <span className="star-verdict">{shown ? VERDICT[shown] : 'Pick a rating'}</span>
            </div>

            <Field id="review-comment" label="In a line">
              <input
                id="review-comment"
                className="contact-input"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="The keyholder decision is the best part."
              />
            </Field>

            <Field id="review-name" label="Your name" hint="optional">
              <input
                id="review-name"
                className="contact-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </Field>

            <Field id="review-email" label="Your email" hint="optional, only if you want a reply">
              <input
                id="review-email"
                className="contact-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </Field>

            {state.k === 'error' && (
              <p className="contact-error" role="alert">
                {state.message}
              </p>
            )}

            <div className="row">
              <button className="primary" disabled={!canSend} onClick={send}>
                {state.k === 'sending' ? 'Sending…' : 'Send review'}
              </button>
              <button onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
