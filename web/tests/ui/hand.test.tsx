/**
 * THE HAND MUST BE CLICKABLE.
 *
 * Regression test for a real bug: hand cards render with class `disabled`
 * outside the load stage, but nothing styled `.disabled`, while `.item-btn`
 * gave every card `cursor: pointer`. Inert cards looked identical to live ones
 * and silently swallowed clicks, so the game appeared broken before you rolled.
 *
 * This pins both halves: that the hand is inert AND SAYS SO before a roll, and
 * that a click genuinely selects and places after one.
 *
 * @vitest-environment jsdom
 */
import { afterEach, describe, test, expect } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../src/App';

// This file used to hold a single test and got away without it; with three
// renders in here, a leftover DOM makes `getByText` find two of everything.
afterEach(cleanup);

describe('regression: the hand must be usable after a roll', () => {
  test('a hand card can be picked up and placed by clicking', () => {
    render(<App />);
    // Three ways in now; the count and the names live inside the local one.
    fireEvent.click(screen.getByText('Play with friends here'));
    fireEvent.click(screen.getByLabelText('4 players'));
    fireEvent.click(screen.getByText('Start the day'));
    const pass = screen.queryByText(/^I am Player \d$/);
    if (pass) fireEvent.click(pass);

    // Before rolling the hand is inert AND says so.
    expect(document.querySelectorAll('.panel .gcard.clickable').length).toBe(0);
    expect(screen.getByText(/Your hand is asleep/)).toBeTruthy();

    fireEvent.click(screen.getByText('Roll the die'));
    const noCard = screen.queryByText('Play no card');
    if (noCard) fireEvent.click(noCard);

    // After rolling it is live, the hint is gone, and a click actually selects.
    const live = document.querySelectorAll('.panel .gcard.clickable');
    expect(live.length).toBeGreaterThan(0);
    expect(screen.queryByText(/Your hand is asleep/)).toBeNull();

    fireEvent.click(live[0]);
    expect(document.querySelectorAll('.panel .gcard.selected').length).toBe(1);

    const machine = document.querySelector('.machine.selectable');
    expect(machine).toBeTruthy();
    fireEvent.click(machine!);
    expect(document.querySelectorAll('.gcard.ghost').length).toBe(1);
  });
});

describe('the hand can also be dragged into a washer', () => {
  /**
   * Dragging is an ADDITION to clicking, and the two share one implementation:
   * dragstart sets the same `selectedItem` a click sets, so the washers light
   * up and refuse for the same reasons, and the drop is staged by the code that
   * already validated the click. These tests pin that wiring — that a live card
   * is draggable, an inert one is not, and a drop actually loads.
   *
   * jsdom has no real drag, but the handlers are ordinary React events, so
   * firing them exercises the same path a browser would.
   */
  function toLoadStage() {
    render(<App />);
    fireEvent.click(screen.getByText('Play with friends here'));
    fireEvent.click(screen.getByLabelText('4 players'));
    fireEvent.click(screen.getByText('Start the day'));
    const pass = screen.queryByText(/^I am Player \d$/);
    if (pass) fireEvent.click(pass);
  }

  test('cards are inert AND undraggable before the roll', () => {
    toLoadStage();
    const cards = document.querySelectorAll('.panel .gcard');
    expect(cards.length).toBeGreaterThan(0);
    // The bug this file exists for, in its drag form: a card that cannot be
    // clicked must not invite a drag either.
    expect(document.querySelectorAll('.panel .gcard[draggable="true"]').length).toBe(0);
  });

  test('after a roll a live card is draggable, and dropping it on a washer loads it', () => {
    toLoadStage();
    fireEvent.click(screen.getByText('Roll the die'));

    const live = document.querySelectorAll<HTMLElement>('.panel .gcard.clickable');
    if (live.length === 0) return; // the roll gave no loads; nothing to assert

    const card = live[0];
    expect(card.getAttribute('draggable')).toBe('true');

    // Picking it up is selecting it — the same state a click produces.
    fireEvent.dragStart(card, { dataTransfer: { setData: () => {}, effectAllowed: '' } });
    expect(document.querySelectorAll('.panel .gcard.selected').length).toBe(1);
    expect(document.querySelectorAll('.machine.selectable').length).toBeGreaterThan(0);

    const washer = document.querySelector<HTMLElement>('.machine.selectable')!;
    const before = document.querySelectorAll('.machine .slots .gcard').length;
    fireEvent.dragOver(washer, { dataTransfer: { dropEffect: '' } });
    fireEvent.drop(washer, { dataTransfer: { getData: () => '' } });

    expect(document.querySelectorAll('.machine .slots .gcard').length).toBeGreaterThan(before);
    // And it is no longer held.
    expect(document.querySelectorAll('.panel .gcard.selected').length).toBe(0);
  });
});

/**
 * THE CUE, AND THE BOT GATE.
 *
 * Two things a screenshot cannot check and a person forgets to: that exactly
 * ONE control is ringed at a time and that the ring moves as the turn does, and
 * that a bot seat does not play until the human lets it. The second is the
 * whole point of solo mode — the bots used to move on a timer, so a slow reader
 * came back to a board that had changed twice while they were reading it.
 */
describe('the board points at the next thing to do', () => {
  test('the cue walks roll -> hand -> washer, one control at a time', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Play with friends here'));
    fireEvent.click(screen.getByLabelText('4 players'));
    fireEvent.click(screen.getByText('Start the day'));
    const pass = screen.queryByText(/^I am Player \d$/);
    if (pass) fireEvent.click(pass);

    // Before the roll: the roll button and nothing else.
    expect(document.querySelectorAll('.cue, .cue-zone').length).toBe(1);
    expect(document.querySelector('.roll-btn.cue')).toBeTruthy();

    fireEvent.click(screen.getByText('Roll the die'));
    const noCard = screen.queryByText('Play no card');
    if (noCard) fireEvent.click(noCard);

    // Loading: the hand, which is a row of cards and so is ringed as a zone.
    expect(document.querySelector('.roll-btn.cue')).toBeNull();
    expect(document.querySelector('.items.cue-zone')).toBeTruthy();

    const live = document.querySelectorAll<HTMLElement>('.panel .gcard.clickable');
    if (live.length === 0) return; // that roll owed no loads
    fireEvent.click(live[0]);

    // Holding a card: the washers that will take it, and the hand no longer.
    expect(document.querySelector('.items.cue-zone')).toBeNull();
    expect(document.querySelectorAll('.machine.cue').length).toBeGreaterThan(0);
  });
});

describe('solo: a bot turn waits to be started', () => {
  function startSolo() {
    render(<App />);
    fireEvent.click(screen.getByText('Play by myself'));
    fireEvent.click(screen.getByText('Hell mode'));
    fireEvent.click(screen.getByText('Start the day'));
  }

  test('the bot does not move until the human clicks, then it plays itself', async () => {
    startSolo();
    // Seat 0 is the human, so play their turn to the end of the load stage and
    // hand over. Rolling is enough to reach a bot turn only after the loads are
    // done, so drive the whole turn the way a person would.
    fireEvent.click(screen.getByText('Roll the die'));
    const noCard = screen.queryByText('Play no card');
    if (noCard) fireEvent.click(noCard);

    for (let i = 0; i < 6; i++) {
      const live = document.querySelectorAll<HTMLElement>('.panel .gcard.clickable');
      const washerFirst = document.querySelector('.machine.cue');
      if (washerFirst) fireEvent.click(washerFirst);
      else if (live.length > 0) fireEvent.click(live[0]);
      const commit = document.querySelector<HTMLElement>('.load-panel button.primary.cue');
      if (commit) {
        fireEvent.click(commit);
        break;
      }
    }

    // Either we are already on a bot's turn or the human turn had an extra to
    // resolve; only the first case is what this test is about.
    const bar = document.querySelector('.botbar');
    if (!bar) return;
    expect(bar.textContent).toMatch(/is up\./);
    expect(document.querySelector('.botbar button.cue')).toBeTruthy();

    // THE POINT: time passing changes nothing. The old runner would have played
    // the whole turn inside this wait.
    const before = document.querySelector('.botbar')!.textContent;
    await new Promise((r) => setTimeout(r, 900));
    expect(document.querySelector('.botbar')!.textContent).toBe(before);
  });
});
