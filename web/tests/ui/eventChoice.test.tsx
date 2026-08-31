/**
 * DRAWING AN EVENT MUST LET YOU CHOOSE A WASHER.
 *
 * Regression test. Under event-timing arm E1 (the default) a Gang or Jimothy
 * card fires the moment it is drawn, mid-turn, and the turn parks at
 * `turn.pendingEvent` until the drawer names a washer. The banner said "pick a
 * washer above" — but `machineSelectable` only handled the separate event
 * PHASE (arms E2/E3), so after dismissing the reveal modal every washer was
 * still unclickable and the turn could never continue.
 *
 * Two states most tests never construct, and both matter here:
 *   - the die's extra effect resolves AFTER loading (roll -> card -> load ->
 *     extra), so the event is not drawn until the load is committed;
 *   - the reveal modal is up when the event lands, and gates the whole board
 *     until it is dismissed.
 *
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, test } from 'vitest';
import { Client } from 'boardgame.io/react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { makeLaundromat } from '../../src/game/Laundromat';
import { Board } from '../../src/ui/Board';

afterEach(cleanup);

/** Fixed seed so the dice are deterministic. */
function mountSeeded(seed: string) {
  const GameClient = Client({
    game: { ...makeLaundromat(), seed },
    board: Board,
    numPlayers: 3,
    debug: false,
  });
  return render(<GameClient />);
}

/**
 * Play the first player's turn far enough to draw an event, if this seed rolls
 * a 6. Returns the reveal banner text, or '' if no event was drawn.
 */
function turnUpToEvent(): string {
  const pass = screen.queryByText(/^I am Player \d$/);
  if (pass) fireEvent.click(pass);

  const roll = screen.queryByText('Roll the die');
  if (!roll) return '';
  fireEvent.click(roll);

  const noCard = screen.queryByText('Play no card');
  if (noCard) fireEvent.click(noCard);

  // Loading comes before the die's extra effect, so it must be committed first.
  const card = document.querySelector('.panel .gcard.clickable');
  if (!card) return '';
  fireEvent.click(card);
  const target = document.querySelector('.machine.selectable');
  if (!target) return '';
  fireEvent.click(target);
  const loadBtn = screen.queryByRole('button', { name: /^Load this one$/ });
  if (!loadBtn) return '';
  fireEvent.click(loadBtn);
  const confirmLoad = screen.queryByText('Load it');
  if (confirmLoad) fireEvent.click(confirmLoad);

  return document.querySelector('.banner h3')?.textContent ?? '';
}

/** Dismiss the "Event drawn: X" modal, which gates the whole board. */
function dismissReveal() {
  const overlay = document.querySelector('.overlay');
  if (!overlay) return;
  const understood = [...overlay.querySelectorAll('button')].find(
    (b) => b.textContent === 'Understood',
  );
  if (understood) fireEvent.click(understood);
}

describe('mid-turn event choice', () => {
  test('a drawn Gang or Jimothy offers selectable washers, and choosing one resolves it', () => {
    let found = '';

    for (let i = 0; i < 60 && !found; i++) {
      cleanup();
      mountSeeded(`seed-${i}`);
      const banner = turnUpToEvent();
      if (!/Gang|Jimothy/.test(banner) || !/happening now/.test(banner)) continue;
      found = banner;

      // While the reveal modal is up, nothing on the board is clickable. That
      // is deliberate — it is the gate, not the bug.
      expect(document.querySelectorAll('.machine.selectable').length).toBe(0);

      dismissReveal();
      expect(document.querySelector('.overlay')).toBeNull();

      // THE BUG: this was 0. The banner asked for a washer that could never be
      // clicked, and the turn was stuck forever.
      const selectable = document.querySelectorAll('.machine.selectable');
      expect(selectable.length).toBeGreaterThan(0);

      // Choosing one must raise the confirmation, not silently no-op.
      fireEvent.click(selectable[0]);
      const overlay = document.querySelector('.overlay');
      expect(overlay).toBeTruthy();
      expect(overlay!.querySelector('h2')?.textContent ?? '').toMatch(/Shoot|Jimothy/);

      // And confirming must actually resolve it: the turn stops waiting.
      const act = [...overlay!.querySelectorAll('button')].find((b) =>
        /^(Shoot it|Put him there|Send him to Washer \d)$/.test(b.textContent ?? ''),
      );
      expect(act, 'the confirmation offers no way to commit the choice').toBeTruthy();
      fireEvent.click(act!);

      expect(document.querySelector('.banner h3')?.textContent ?? '').not.toMatch(
        /happening now/,
      );
    }

    expect(found, 'no seed in 60 produced a mid-turn Gang/Jimothy draw').toBeTruthy();
  });
});
