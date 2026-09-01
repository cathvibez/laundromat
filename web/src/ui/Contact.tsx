/**
 * STAY IN TOUCH, and LEAVE A REVIEW.
 *
 * Both of these end in a `mailto:`, and that is the whole design rather than a
 * shortcut. The server has no persistence of any kind — rooms live in a Map in
 * server/rooms.ts, there is no database and no mounted volume, and the logs are
 * a live stream with no history — so anything this screen "saved" would have an
 * expected lifetime of "until the next deploy". A mailto has none of that
 * problem: the message lands in a real inbox, it survives everything, and it
 * needs no endpoint, no storage and no privacy policy.
 *
 * The cost is honesty about what the buttons do, which is why neither of them
 * pretends to be a form that submits. They compose a message and hand it to the
 * player's own mail client, and both show the address in plain text as well,
 * because a browser with no mail client configured would otherwise dead-end.
 */

import { useState } from 'react';

/** Where a support ticket or a review actually goes. */
export const CONTACT_EMAIL = 'kailinzheng12@gmail.com';

function mailto(subject: string, body: string): string {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Copy, with the older API as a fallback and a plain failure if neither works. */
function useCopy(): [boolean, (text: string) => void] {
  const [done, setDone] = useState(false);
  const copy = (text: string) => {
    const ok = () => {
      setDone(true);
      window.setTimeout(() => setDone(false), 1800);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(ok).catch(() => undefined);
      return;
    }
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      ok();
    } catch {
      /* the address is on screen either way */
    }
  };
  return [done, copy];
}

function EmailLine() {
  const [copied, copy] = useCopy();
  return (
    <div className="contact-line">
      <code className="contact-addr">{CONTACT_EMAIL}</code>
      <button type="button" className="contact-copy" onClick={() => copy(CONTACT_EMAIL)}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ stay in touch */

export function StayInTouch({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const trimmed = email.trim();

  /*
   * The address is put in the BODY as well as being the sender. A mail client
   * sends from whichever account it happens to be signed into, which is often
   * not the address someone actually wants to be reached on.
   */
  const href = mailto(
    'Laundromat — keep me posted',
    `Keep me posted about Laundromat.\n\n` +
      (trimmed ? `Best address for me: ${trimmed}\n\n` : '') +
      `(Anything else you want to say goes here.)\n`,
  );

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal contact-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Stay in touch</h2>
        <p>
          Laundromat is a board game in development. If you want to hear when there is
          something worth hearing about — a playtest, a print run — send a note and you
          are on the list. No newsletter, no schedule, and nothing else ever.
        </p>

        <label className="contact-label" htmlFor="contact-email">
          Your email
        </label>
        <input
          id="contact-email"
          type="email"
          className="contact-input"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <p className="note">
          This opens your own mail app with the message ready — nothing is sent from
          this page, and nothing is stored here.
        </p>

        <div className="row">
          <a className="button-link primary" href={href}>
            Write the email
          </a>
          <button onClick={onClose}>Close</button>
        </div>

        <p className="note">Or write to it directly:</p>
        <EmailLine />
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
  const [text, setText] = useState('');
  const shown = hover || stars;

  const href = mailto(
    `Laundromat review — ${stars}/5 ${VERDICT[stars] ?? ''}`.trim(),
    `${stars} out of 5 — ${VERDICT[stars] ?? ''}\n\n${text.trim() || '(no comment)'}\n`,
  );

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal contact-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Leave a review</h2>
        <p>
          The game is still being designed, so an honest reaction is worth more than a
          kind one. What worked, what dragged, what you would change.
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

        <label className="contact-label" htmlFor="review-text">
          In your words (optional)
        </label>
        <textarea
          id="review-text"
          className="contact-input"
          rows={4}
          placeholder="The keyholder decision is the best part. The middle days drag."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="note">
          This opens your own mail app with the review ready — nothing is sent from this
          page, and nothing is stored here.
        </p>

        <div className="row">
          {/* Disabled as a span, not an <a>: an anchor with no href is not a
              button to a screen reader, and a mailto with 0/5 in the subject is
              a review nobody meant to leave. */}
          {stars === 0 ? (
            <span className="button-link disabled" aria-disabled="true">
              Pick a rating first
            </span>
          ) : (
            <a className="button-link primary" href={href}>
              Write the review
            </a>
          )}
          <button onClick={onClose}>Close</button>
        </div>

        <p className="note">Or write to it directly:</p>
        <EmailLine />
      </div>
    </div>
  );
}
