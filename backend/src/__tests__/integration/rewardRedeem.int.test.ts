import { readFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import pool from '../../config/db.js';
import { evaluatePickemRewardsTx, evaluateStatRewardsForTournamentTx } from '../../repositories/reward.repo.js';
import { unsettleTx } from '../../repositories/pickem.repo.js';
import { anon, as } from './helpers/api.js';
import { all, insert, one, testDb } from './helpers/db.js';
import { createFaculty, createMatch, createSportType, createTeam, createTournament, createUser, type TestUser } from './helpers/factories.js';

let buyer: TestUser;
let badge: number;
let price: number;

beforeEach(async () => {
    buyer = await createUser();
    const item = await one<{ reward_id: number; points_required: number }>(
        "SELECT reward_id, points_required FROM rewards WHERE name = 'ผู้สนับสนุนบรอนซ์'"
    );
    if (!item) throw new Error('Purchasable badge migration did not run');
    badge = item.reward_id;
    price = item.points_required;
    await testDb().query('UPDATE users SET total_points = 100 WHERE user_id = ?', [buyer.id]);
});

const redeem = (id = badge, user = buyer) => as(user).post(`/me/rewards/${id}/redeem`);
const balance = () => one<{ total_points: number }>('SELECT total_points FROM users WHERE user_id = ?', [buyer.id]);
const owned = () => all<{ reward_id: number }>('SELECT reward_id FROM user_rewards WHERE user_id = ?', [buyer.id]);
const ledger = () => all<{ amount: number; source: string; ref_id: number }>(
    'SELECT amount, source, ref_id FROM point_transactions WHERE user_id = ?', [buyer.id]
);

describe('POST /me/rewards/:id/redeem', () => {
    it('debits the wallet, grants a visible badge, records a negative transaction, and returns the balance', async () => {
        const res = await redeem();
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ rewardId: badge, pointsSpent: price, totalPoints: 100 - price });
        expect(await balance()).toEqual({ total_points: 100 - price });
        expect(await owned()).toEqual([{ reward_id: badge }]);
        expect(await ledger()).toEqual([{ amount: -price, source: 'reward_redeem', ref_id: badge }]);
        expect((await as(buyer).get('/me')).body.totalPoints).toBe(100 - price);
        expect((await as(buyer).get('/me/rewards')).body.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: badge })]));
    });

    it('requires authentication and a positive integer reward id', async () => {
        expect((await anon.post(`/me/rewards/${badge}/redeem`)).status).toBe(401);
        for (const id of ['0', '-1', 'abc', '1.5']) {
            expect((await as(buyer).post(`/me/rewards/${id}/redeem`)).status).toBe(400);
        }
        expect(await balance()).toEqual({ total_points: 100 });
        expect(await ledger()).toEqual([]);
    });

    it('returns 404 for missing and inactive rewards without charging', async () => {
        const inactive = await insert('rewards', { reward_type: 'badge', name: 'inactive', points_required: 10, is_active: false });
        for (const id of [2147483647, inactive]) {
            const res = await redeem(id);
            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe('REWARD_NOT_FOUND');
        }
        expect(await balance()).toEqual({ total_points: 100 });
    });

    it('rejects an achievement before checking ownership', async () => {
        const achievement = await insert('rewards', { reward_type: 'achievement', name: 'earned only', points_required: null });
        await insert('user_rewards', { user_id: buyer.id, reward_id: achievement });
        const res = await redeem(achievement);
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('REWARD_NOT_PURCHASABLE');
        expect(await ledger()).toEqual([]);
    });

    it('insufficient funds leave all three tables unchanged and report the current balance', async () => {
        await testDb().query('UPDATE users SET total_points = ? WHERE user_id = ?', [price - 1, buyer.id]);
        const res = await redeem();
        expect(res.status).toBe(409);
        expect(res.body.error).toMatchObject({ code: 'INSUFFICIENT_POINTS', pointsRequired: price, totalPoints: price - 1 });
        expect(await balance()).toEqual({ total_points: price - 1 });
        expect(await owned()).toEqual([]);
        expect(await ledger()).toEqual([]);
    });

    it('an existing owner gets 409 even with an empty wallet', async () => {
        expect((await redeem()).status).toBe(200);
        await testDb().query('UPDATE users SET total_points = 0 WHERE user_id = ?', [buyer.id]);
        const res = await redeem();
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('REWARD_ALREADY_OWNED');
        expect(await balance()).toEqual({ total_points: 0 });
        expect(await ledger()).toHaveLength(1);
    });

    it.each([30, 100])('simultaneous requests buy the same badge once with %i points', async (points) => {
        await testDb().query('UPDATE users SET total_points = ? WHERE user_id = ?', [points, buyer.id]);
        const responses = await Promise.all([redeem(), redeem()]);
        expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
        expect(responses.find(r => r.status === 409)?.body.error.code).toBe('REWARD_ALREADY_OWNED');
        expect(await balance()).toEqual({ total_points: points - price });
        expect(await owned()).toEqual([{ reward_id: badge }]);
        expect(await ledger()).toEqual([{ amount: -price, source: 'reward_redeem', ref_id: badge }]);
    });

    it('simultaneous purchases of different badges cannot overspend a shared wallet', async () => {
        const second = await insert('rewards', { reward_type: 'badge', name: 'competing purchase', points_required: price, criteria: null });
        await testDb().query('UPDATE users SET total_points = ? WHERE user_id = ?', [price, buyer.id]);
        const responses = await Promise.all([redeem(), redeem(second)]);
        expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
        expect(responses.find(r => r.status === 409)?.body.error).toMatchObject({ code: 'INSUFFICIENT_POINTS', totalPoints: 0 });
        expect(await balance()).toEqual({ total_points: 0 });
        expect(await owned()).toHaveLength(1);
        expect(await ledger()).toHaveLength(1);
    });

    it('a ledger failure rolls back both the debit and badge grant', async () => {
        await testDb().query("CREATE TRIGGER reject_test_redemption BEFORE INSERT ON point_transactions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test ledger failure'");
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            expect((await redeem()).status).toBe(500);
            expect(await balance()).toEqual({ total_points: 100 });
            expect(await owned()).toEqual([]);
            expect(await ledger()).toEqual([]);
        } finally {
            log.mockRestore();
            await testDb().query('DROP TRIGGER reject_test_redemption');
        }
        expect((await redeem()).status).toBe(200);
    });

    it('cannot spend or grant on behalf of another user using request body fields', async () => {
        const other = await createUser();
        const res = await redeem().send({ userId: other.id, pointsRequired: 0 });
        expect(res.status).toBe(200);
        expect(await owned()).toEqual([{ reward_id: badge }]);
        expect(await one('SELECT total_points FROM users WHERE user_id = ?', [other.id])).toEqual({ total_points: 0 });
    });
});

describe('purchased badge lifecycle', () => {
    it('keeps the purchased badge after tournament completion and result point reversal', async () => {
        const faculty = await createFaculty();
        const sport = await createSportType();
        const organizer = await createUser();
        const opponent = await createUser();
        const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
        const teamA = await createTeam({ leader: buyer.id, sportTypeId: sport });
        const teamB = await createTeam({ leader: opponent.id, sportTypeId: sport });
        const application = await insert('tournament_applications', { tournament_id: tour, team_id: teamA, tournament_application_status: 'approved' });
        await insert('application_players', { tournament_application_id: application, tournament_id: tour, user_id: buyer.id });
        const match = await createMatch({ tournamentId: tour, teamA, teamB, status: 'completed' });
        await insert('pickem_predictions', { match_id: match, user_id: buyer.id, predicted_winner_team_id: teamA, points_earned: 100, tier: 'spot_on' });
        expect((await redeem()).status).toBe(200);
        const close = await as(organizer).post(`/tournaments/${tour}/complete`);
        expect(close.status).toBe(200);
        expect(await balance()).toEqual({ total_points: 100 - price });
        expect(await one('SELECT SUM(points_earned) AS earned FROM pickem_predictions WHERE user_id = ?', [buyer.id]))
            .toEqual({ earned: '100' });
        expect(await owned()).toEqual(expect.arrayContaining([{ reward_id: badge }]));
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            await unsettleTx(conn, match);
            await evaluateStatRewardsForTournamentTx(conn, tour);
            await evaluatePickemRewardsTx(conn, match);
            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
        expect(await balance()).toEqual({ total_points: 0 });
        expect(await owned()).toEqual(expect.arrayContaining([{ reward_id: badge }]));
        expect(await ledger()).toEqual([{ amount: -price, source: 'reward_redeem', ref_id: badge }]);
    });

    it('catalogue migration is repeatable and every sale badge is protected from automatic rewards', async () => {
        const file = await readFile(new URL('../../../../database/migrations/056_purchasable_badges.sql', import.meta.url), 'utf8');
        await testDb().query(file);
        await testDb().query(file);
        const badges = await all<{ name: string; points_required: number; criteria: unknown }>(
            'SELECT name, points_required, criteria FROM rewards WHERE points_required IS NOT NULL'
        );
        expect(badges.filter(b => ['ผู้สนับสนุนบรอนซ์', 'ผู้สนับสนุนซิลเวอร์', 'ผู้สนับสนุนโกลด์'].includes(b.name))).toHaveLength(3);
        for (const item of badges) {
            expect(item.points_required).toBeGreaterThan(0);
            expect(item.criteria).toBeNull();
        }
    });
});
