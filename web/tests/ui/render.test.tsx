/**
 * UI smoke tests.  These render the real Board against a real boardgame.io
 * client and drive it through a day, so a crash in the view layer is caught by
 * `npm test` rather than by a human opening the browser.
 *
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, test } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Client } from 'boardgame.io/react';
import { makeLaundromat } from '../../src/game/Laundromat';
import { Board } from '../../src/ui/Board';
import { App } from '../../src/App';

// Unmount between tests, so a failing test cannot leak its DOM into the next.
afterEach(cleanup);

function mountGame(numPlayers = 3) {
  const GameClient = Client({
    game: makeLaundromat(),
    board: Board,
    numPlayers,
    debug: false,
  });
  return render(<GameClient />);
}

describe('UI', () => {
  test('the setup screen renders and flags the provisional deck', () => {
    render(<App />);
    expect(screen.getByText('Laundromat')).toBeTruthy();
    expect(screen.getByText(/Special item deck is provisional/i)).toBeTruthy();
    expect(screen.getByText(/FLAT PLACEHOLDER/i)).toBeTruthy();
  });

  test('the setup screen offers no rule switches — only the seat count', () => {
    render(<App />);
    // The four A/B and sensitivity controls were resolved and deleted in v10.
    expect(screen.queryByLabelText(/Circuit break/i)).toBeNull();
    expect(screen.queryByLabelText(/Event timing/i)).toBeNull();
    expect(screen.queryByText(/Sensitivity switches/i)).toBeNull();
    // The seat count is still the only thing the screen asks for; it is a
    // required button group now rather than a pre-filled <select>.
    expect(screen.getByLabelText(/Number of players/i)).toBeTruthy();
    expect(
      (screen.getByText('Play on this device') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  test('the board renders every machine, the key, the day and the hand', () => {
    mountGame(4);
    // Hot-seat privacy screen first.
    fireEvent.click(screen.getByText('I am Player 1'));

    expect(screen.getByText('Day 1')).toBeTruthy();
    expect(screen.getByText('Key: Player 1')).toBeTruthy();
    // 4 players -> 5 machines, each showing capacity out of 4.
    for (let i = 1; i <= 5; i++) expect(screen.getByText(`M${i}`)).toBeTruthy();
    // Four players: five washers, each holding five (capacity scales with the
    // table since v11, so this is not a flat 4 any more).
    expect(screen.getAllByText('0/5').length).toBe(5);
    expect(screen.getByText(/Player 1 · hand/)).toBeTruthy();
    // No damp zone: socks stranded by a blanket stay in the machine (v10).
    expect(screen.queryByText(/Damp zone/)).toBeNull();
    expect(screen.getByText(/Fresh · drawn today/)).toBeTruthy();
    expect(screen.getByText(/Ready · playable/)).toBeTruthy();
  });

  test('rolling shows the die and what it entitles you to, then loading works', () => {
    mountGame(3);
    fireEvent.click(screen.getByText('I am Player 1'));
    fireEvent.click(screen.getByText('Roll the die'));

    // The die face and its entitlement are both on screen.
    expect(screen.getByText(/Loading is mandatory|You may play one ready card/)).toBeTruthy();

    // Pass the card stage if we are in it.
    const pass = screen.queryByText('Play no card');
    if (pass) fireEvent.click(pass);

    expect(screen.getByText(/Loading is mandatory/)).toBeTruthy();

    // Pick the first item in hand, then the first machine.
    // Click to pick up, click a washer to place. Drag was tried and removed:
    // it did not work in the designer's browser and buys nothing over clicking.
    const tap = (el: Element) => fireEvent.click(el);

    const handButtons = document.querySelectorAll('.panel .gcard.item-btn.clickable');
    expect(handButtons.length).toBeGreaterThan(0);
    tap(handButtons[0]);
    expect(screen.getByText(/now click a washer to put it there/)).toBeTruthy();

    // Deselecting must work: click it again and the prompt reverts.
    tap(handButtons[0]);
    expect(screen.getByText(/Click a card, then click the washer/)).toBeTruthy();
    tap(handButtons[0]);

    const selectable = document.querySelector('.machine.selectable');
    expect(selectable).toBeTruthy();
    fireEvent.click(selectable!);

    // Staged, not committed: it shows on the board as a pending ghost CARD and is
    // removable. (Markup moved from .slot.filled.ghost to .gcard.ghost in the
    // paper-cutout restyle; the behaviour under test is unchanged.)
    expect(document.querySelectorAll('.gcard.ghost').length).toBe(1);
    expect(screen.getByText('Not yet committed')).toBeTruthy();

    // Removing a staged item puts it back in hand and disables the Load button.
    fireEvent.click(screen.getByText('Remove'));
    expect(document.querySelectorAll('.gcard.ghost').length).toBe(0);

    // Re-stage ONE card. Loading is mandatory in total, but it no longer has to
    // happen in a single commit: the Load button lights up as soon as one card
    // is staged, and the turn stays on the load stage until the quota is met.
    const item = document.querySelectorAll('.panel .gcard.item-btn.clickable')[0];
    expect(item).toBeTruthy();
    tap(item);
    const machine = document.querySelector('.machine.selectable');
    expect(machine).toBeTruthy();
    fireEvent.click(machine!);

    expect(document.querySelectorAll('.gcard.ghost').length).toBe(1);
    const loadBtn = screen.getByRole('button', { name: /^Load this one$/ }) as HTMLButtonElement;
    expect(loadBtn.disabled).toBe(false);

    fireEvent.click(loadBtn);
    fireEvent.click(screen.getByText('Load it'));

    // A one-item load can end the turn outright, which raises the hot-seat
    // pass screen; step through it so the floor is visible again.
    const nextPlayer = screen.queryByText(/^I am Player \d$/);
    if (nextPlayer) fireEvent.click(nextPlayer);

    // The item is on the floor and stays there for everyone to see.
    expect(document.querySelectorAll('.slots .gcard').length).toBeGreaterThanOrEqual(1);
  });

  test('every machine narrates what will happen tonight', () => {
    mountGame(3);
    fireEvent.click(screen.getByText('I am Player 1'));
    const tonights = document.querySelectorAll('.machine .tonight');
    expect(tonights.length).toBe(4);
    for (const t of tonights) {
      expect(t.textContent).toMatch(/Empty|Tonight|off|Jimothy|Gang/i);
    }
  });
});
