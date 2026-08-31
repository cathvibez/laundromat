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
import { describe, test, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../src/App';

describe('regression: the hand must be usable after a roll', () => {
  test('a hand card can be picked up and placed by clicking', () => {
    render(<App />);
    // The seat count is a required choice now — the hot-seat button stays
    // disabled until one is picked, so choosing is part of starting.
    fireEvent.click(screen.getByLabelText('4 players'));
    fireEvent.click(screen.getByText('Play on this device'));
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
