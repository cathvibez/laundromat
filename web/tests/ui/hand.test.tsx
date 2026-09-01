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
