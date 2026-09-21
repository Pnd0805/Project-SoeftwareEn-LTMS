import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/notification.repo.js', () => ({
  insertNotification: vi.fn(),
  findByUser: vi.fn(),
  countUnread: vi.fn(),
  findOwned: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  findMatchAudience: vi.fn(),
  findTournamentTeamLeaders: vi.fn(),
  findTournamentReferees: vi.fn(),
  findMatchResultParties: vi.fn(),
}));

import * as NotificationService from '../notification.service.js';
import * as NotificationRepo from '../../repositories/notification.repo.js';
import type { NotificationRow } from '../../repositories/notification.repo.js';
import { AppError } from '../../utils/AppError.js';

function row(overrides: Partial<NotificationRow> = {}): NotificationRow {
  return {
    notification_id: 1,
    user_id: 5,
    type: 'application_decided',
    title: 'ใบสมัครได้รับการอนุมัติ',
    message: 'ใบสมัครของทีม "ทีมเสือ" ได้รับการอนุมัติแล้ว',
    related_entity_type: 'tournament',
    related_entity_id: 20,
    is_read: 0,
    created_at: new Date('2026-09-21T10:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listMyNotifications (C1-ก GET /me/notifications)', () => {
  it('maps rows to DTOs and returns unreadCount + pagination', async () => {
    vi.mocked(NotificationRepo.findByUser).mockResolvedValue({ rows: [row(), row({ notification_id: 2, is_read: 1 })], totalItems: 2 });
    vi.mocked(NotificationRepo.countUnread).mockResolvedValue(1);

    const result = await NotificationService.listMyNotifications(5, false, 1, 20, 0);

    expect(NotificationRepo.findByUser).toHaveBeenCalledWith(5, false, 0, 20);
    expect(result.items[0]).toEqual({
      id: 1, type: 'application_decided', title: 'ใบสมัครได้รับการอนุมัติ',
      message: 'ใบสมัครของทีม "ทีมเสือ" ได้รับการอนุมัติแล้ว',
      relatedEntityType: 'tournament', relatedEntityId: 20,
      isRead: false, createdAt: new Date('2026-09-21T10:00:00Z'),
    });
    expect(result.items[1]!.isRead).toBe(true);
    expect(result.unreadCount).toBe(1);
    expect(result.pagination).toEqual({ page: 1, pageSize: 20, totalItems: 2, totalPages: 1 });
  });

  it('passes the unread-only filter through to the repository', async () => {
    vi.mocked(NotificationRepo.findByUser).mockResolvedValue({ rows: [], totalItems: 0 });
    vi.mocked(NotificationRepo.countUnread).mockResolvedValue(0);

    await NotificationService.listMyNotifications(5, true, 2, 10, 10);

    expect(NotificationRepo.findByUser).toHaveBeenCalledWith(5, true, 10, 10);
  });
});

describe('markMyNotificationRead (C1-ก PATCH /me/notifications/:id/read)', () => {
  it('marks an unread notification of the owner as read', async () => {
    vi.mocked(NotificationRepo.findOwned).mockResolvedValue(row());

    const result = await NotificationService.markMyNotificationRead(1, 5);

    expect(NotificationRepo.markRead).toHaveBeenCalledWith(1, 5);
    expect(result).toMatchObject({ id: 1, isRead: true });
  });

  it('is idempotent — an already-read notification is returned without another update', async () => {
    vi.mocked(NotificationRepo.findOwned).mockResolvedValue(row({ is_read: 1 }));

    await expect(NotificationService.markMyNotificationRead(1, 5)).resolves.toMatchObject({ isRead: true });
    expect(NotificationRepo.markRead).not.toHaveBeenCalled();
  });

  it("returns 404 NOTIFICATION_NOT_FOUND for someone else's (or a missing) notification", async () => {
    vi.mocked(NotificationRepo.findOwned).mockResolvedValue(null);

    const err = await NotificationService.markMyNotificationRead(1, 999).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ status: 404, code: 'NOTIFICATION_NOT_FOUND' });
    expect(NotificationRepo.markRead).not.toHaveBeenCalled();
  });
});

describe('markAllMyNotificationsRead (C1-ก POST /me/notifications/read-all)', () => {
  it('returns how many were updated and unreadCount 0', async () => {
    vi.mocked(NotificationRepo.markAllRead).mockResolvedValue(3);

    await expect(NotificationService.markAllMyNotificationsRead(5)).resolves.toEqual({ updated: 3, unreadCount: 0 });
    expect(NotificationRepo.markAllRead).toHaveBeenCalledWith(5);
  });
});

describe('notify helpers (C1-ข)', () => {
  const content = { type: 'checkin_opened', title: 'เปิดเช็คอินแล้ว', message: 'x', relatedEntityType: 'match', relatedEntityId: 42 };

  it('never throws even if writing a notification fails — the action that triggered it already succeeded', async () => {
    vi.mocked(NotificationRepo.insertNotification).mockRejectedValue(new Error('db down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(NotificationService.notify({ userId: 5, ...content })).resolves.toBeUndefined();
    spy.mockRestore();
  });

  it('keeps sending to the rest when one recipient fails', async () => {
    vi.mocked(NotificationRepo.insertNotification)
      .mockRejectedValueOnce(new Error('fk'))
      .mockResolvedValue(1);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await NotificationService.notifyUsers([1, 2, 3], content);

    expect(NotificationRepo.insertNotification).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });

  it('sends one notification per distinct user', async () => {
    vi.mocked(NotificationRepo.insertNotification).mockResolvedValue(1);

    await NotificationService.notifyUsers([7, 7, 8], content);

    expect(NotificationRepo.insertNotification).toHaveBeenCalledTimes(2);
    expect(NotificationRepo.insertNotification).toHaveBeenCalledWith({ ...content, userId: 7 });
    expect(NotificationRepo.insertNotification).toHaveBeenCalledWith({ ...content, userId: 8 });
  });

  it('notifyMatchAudience sends to the registered players and referees of the match', async () => {
    vi.mocked(NotificationRepo.findMatchAudience).mockResolvedValue([101, 102, 900]);
    vi.mocked(NotificationRepo.insertNotification).mockResolvedValue(1);

    await NotificationService.notifyMatchAudience(42, content);

    expect(NotificationRepo.findMatchAudience).toHaveBeenCalledWith(42);
    expect(NotificationRepo.insertNotification).toHaveBeenCalledTimes(3);
  });

  it('notifyMatchResultParties sends to both leaders and referees but skips the person who acted', async () => {
    vi.mocked(NotificationRepo.findMatchResultParties).mockResolvedValue({ leaderIds: [10, 20], refereeIds: [30], organizerId: 99 });
    vi.mocked(NotificationRepo.insertNotification).mockResolvedValue(1);

    await NotificationService.notifyMatchResultParties(42, content, { exceptUserId: 10 });

    const sentTo = vi.mocked(NotificationRepo.insertNotification).mock.calls.map(c => c[0].userId);
    expect(sentTo.sort()).toEqual([20, 30]);
  });

  it('notifyMatchResultParties includes the organizer only when asked (dispute)', async () => {
    vi.mocked(NotificationRepo.findMatchResultParties).mockResolvedValue({ leaderIds: [10, 20], refereeIds: [], organizerId: 99 });
    vi.mocked(NotificationRepo.insertNotification).mockResolvedValue(1);

    await NotificationService.notifyMatchResultParties(42, content, { exceptUserId: 10, includeOrganizer: true });

    const sentTo = vi.mocked(NotificationRepo.insertNotification).mock.calls.map(c => c[0].userId);
    expect(sentTo.sort()).toEqual([20, 99]);
  });

  it('tournament helpers send to the team leaders / referees of that tournament', async () => {
    vi.mocked(NotificationRepo.findTournamentTeamLeaders).mockResolvedValue([1, 2]);
    vi.mocked(NotificationRepo.findTournamentReferees).mockResolvedValue([3]);
    vi.mocked(NotificationRepo.insertNotification).mockResolvedValue(1);

    await NotificationService.notifyTournamentTeamLeaders(20, content);
    await NotificationService.notifyTournamentReferees(20, content);

    expect(NotificationRepo.findTournamentTeamLeaders).toHaveBeenCalledWith(20);
    expect(NotificationRepo.findTournamentReferees).toHaveBeenCalledWith(20);
    expect(NotificationRepo.insertNotification).toHaveBeenCalledTimes(3);
  });
});
