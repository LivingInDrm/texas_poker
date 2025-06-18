"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Card_1 = require("../../src/game/Card");
describe('Card', () => {
    describe('Constructor and basic properties', () => {
        test('should create a card with suit and rank', () => {
            const card = new Card_1.Card(Card_1.Suit.HEARTS, Card_1.Rank.ACE);
            expect(card.suit).toBe(Card_1.Suit.HEARTS);
            expect(card.rank).toBe(Card_1.Rank.ACE);
        });
    });
    describe('toString method', () => {
        test('should return correct string representation for ace of spades', () => {
            const card = new Card_1.Card(Card_1.Suit.SPADES, Card_1.Rank.ACE);
            expect(card.toString()).toBe('A♠');
        });
        test('should return correct string representation for ten of hearts', () => {
            const card = new Card_1.Card(Card_1.Suit.HEARTS, Card_1.Rank.TEN);
            expect(card.toString()).toBe('10♥');
        });
        test('should return correct string representation for face cards', () => {
            expect(new Card_1.Card(Card_1.Suit.DIAMONDS, Card_1.Rank.JACK).toString()).toBe('J♦');
            expect(new Card_1.Card(Card_1.Suit.CLUBS, Card_1.Rank.QUEEN).toString()).toBe('Q♣');
            expect(new Card_1.Card(Card_1.Suit.HEARTS, Card_1.Rank.KING).toString()).toBe('K♥');
        });
    });
    describe('toShortString method', () => {
        test('should return correct short representation', () => {
            expect(new Card_1.Card(Card_1.Suit.SPADES, Card_1.Rank.ACE).toShortString()).toBe('AS');
            expect(new Card_1.Card(Card_1.Suit.HEARTS, Card_1.Rank.TEN).toShortString()).toBe('TH');
            expect(new Card_1.Card(Card_1.Suit.DIAMONDS, Card_1.Rank.TWO).toShortString()).toBe('2D');
            expect(new Card_1.Card(Card_1.Suit.CLUBS, Card_1.Rank.KING).toShortString()).toBe('KC');
        });
    });
    describe('compareRank method', () => {
        test('should compare ranks correctly', () => {
            const aceHearts = new Card_1.Card(Card_1.Suit.HEARTS, Card_1.Rank.ACE);
            const kingSpades = new Card_1.Card(Card_1.Suit.SPADES, Card_1.Rank.KING);
            const aceSpades = new Card_1.Card(Card_1.Suit.SPADES, Card_1.Rank.ACE);
            expect(aceHearts.compareRank(kingSpades)).toBeGreaterThan(0);
            expect(kingSpades.compareRank(aceHearts)).toBeLessThan(0);
            expect(aceHearts.compareRank(aceSpades)).toBe(0);
        });
    });
    describe('equals method', () => {
        test('should identify equal cards', () => {
            const card1 = new Card_1.Card(Card_1.Suit.HEARTS, Card_1.Rank.ACE);
            const card2 = new Card_1.Card(Card_1.Suit.HEARTS, Card_1.Rank.ACE);
            const card3 = new Card_1.Card(Card_1.Suit.SPADES, Card_1.Rank.ACE);
            expect(card1.equals(card2)).toBe(true);
            expect(card1.equals(card3)).toBe(false);
        });
    });
    describe('toJSON method', () => {
        test('should return correct JSON representation', () => {
            const card = new Card_1.Card(Card_1.Suit.HEARTS, Card_1.Rank.ACE);
            const json = card.toJSON();
            expect(json).toEqual({
                suit: Card_1.Suit.HEARTS,
                rank: Card_1.Rank.ACE,
                display: 'A♥'
            });
        });
    });
});
