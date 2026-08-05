/**
 * UI smoke tests.  These render the real Board against a real boardgame.io
 * client and drive it through a day, so a crash in the view layer is caught by
 * `npm test` rather than by a human opening the browser.
 *
 * @vitest-environment jsdom
 */

import { describe, expect, test } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Client } from 'boardgame.io/react';
import { makeLaundromat } from '../../src/game/Laundromat';
import { Board } from '../../src/ui/Board';
import { App } from '../../src/App';

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
    cleanup();
  });

  test('the board renders every machine, the key, the day and the hand', () => {
    mountGame(4);
    // Hot-seat privacy screen first.
    fireEvent.click(screen.getByText('I am Player 1'));

    expect(screen.getByText('Day 1')).toBeTruthy();
    expect(screen.getByText('Key: Player 1')).toBeTruthy();
    // 4 players -> 5 machines, each showing capacity out of 4.
    for (let i = 1; i <= 5; i++) expect(screen.getByText(`M${i}`)).toBeTruthy();
    expect(screen.getAllByText('0/4').length).toBe(5);
    expect(screen.getByText(/Player 1 · hand/)).toBeTruthy();
    expect(screen.getByText(/Damp zone · public/)).toBeTruthy();
    expect(screen.getByText(/Fresh · drawn today/)).toBeTruthy();
    expect(screen.getByText(/Ready · playable/)).toBeTruthy();
    cleanup();
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
    const handButtons = document.querySelectorAll('.panel .item-btn:not(:disabled)');
    expect(handButtons.length).toBeGreaterThan(0);
    fireEvent.click(handButtons[0]);
    expect(screen.getByText(/nothing is committed until you confirm/)).toBeTruthy();

    // Deselecting must work: click it again, and the prompt goes away.
    fireEvent.click(handButtons[0]);
    expect(screen.getByText(/Pick one item from your hand/)).toBeTruthy();
    fireEvent.click(handButtons[0]);

    const selectable = document.querySelector('.machine.selectable');
    expect(selectable).toBeTruthy();
    fireEvent.click(selectable!);

    // Nothing is committed yet: a confirmation stands between click and load.
    expect(screen.getByText(/^Load .* into M\d\?$/)).toBeTruthy();
    expect(document.querySelectorAll('.slot.filled').length).toBe(0);

    // Cancelling leaves the board untouched.
    fireEvent.click(screen.getByText('Cancel'));
    expect(document.querySelectorAll('.slot.filled').length).toBe(0);

    // Doing it for real commits.
    fireEvent.click(document.querySelector('.machine.selectable')!);
    fireEvent.click(screen.getByText('Load it'));

    // A one-item load can end the turn outright, which raises the hot-seat
    // pass screen; step through it so the floor is visible again.
    const nextPlayer = screen.queryByText(/^I am Player \d$/);
    if (nextPlayer) fireEvent.click(nextPlayer);

    // The item is on the floor and stays there for everyone to see.
    expect(document.querySelectorAll('.slot.filled').length).toBeGreaterThanOrEqual(1);
    cleanup();
  });

  test('every machine narrates what will happen tonight', () => {
    mountGame(3);
    fireEvent.click(screen.getByText('I am Player 1'));
    const tonights = document.querySelectorAll('.machine .tonight');
    expect(tonights.length).toBe(4);
    for (const t of tonights) {
      expect(t.textContent).toMatch(/Empty|Tonight|off|Jimothy|Gang/i);
    }
    cleanup();
  });
});
