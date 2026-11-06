import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/reward.service.js', () => ({
  listRewards: vi.fn(),
  listPublicUserRewards: vi.fn(),
  listMyRewards: vi.fn(),
  setMyRewardDisplayed: vi.fn(),
  redeemReward: vi.fn(),
}));

import {
  listRewards,
  listPublicUserRewards,
  listMyRewards,
  setMyRewardDisplayed,
  redeemReward,
} from '../reward.controller.js';
import * as RewardService from '../../services/reward.service.js';

const mockedService = vi.mocked(RewardService);

function makeRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

const badId = {
  status: 400,
  code: 'VALIDATION_FAILED',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reward.controller listRewards()', () => {
  it('responds 200 with the reward catalogue and takes no input', async () => {
    const res = makeRes();
    const catalogue = [{ reward_id: 1 }, { reward_id: 2 }];
    mockedService.listRewards.mockResolvedValue(catalogue as never);

    await listRewards({} as Request, res);

    expect(mockedService.listRewards).toHaveBeenCalledWith();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(catalogue);
  });

  it('propagates a service error', async () => {
    const err = new Error('DB_DOWN');
    mockedService.listRewards.mockRejectedValue(err);
    await expect(listRewards({} as Request, makeRes())).rejects.toBe(err);
  });
});

describe('reward.controller listPublicUserRewards()', () => {
  it('lists rewards of the user in the path, responds 200', async () => {
    const req = { params: { id: '8' } } as unknown as Request;
    const res = makeRes();
    mockedService.listPublicUserRewards.mockResolvedValue([{ reward_id: 3 }] as never);

    await listPublicUserRewards(req, res);

    expect(mockedService.listPublicUserRewards).toHaveBeenCalledWith(8);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ reward_id: 3 }]);
  });

  it('rejects a non-numeric user id without calling the service', async () => {
    const req = { params: { id: 'me' } } as unknown as Request;
    await expect(listPublicUserRewards(req, makeRes())).rejects.toMatchObject({
      ...badId,
      extra: { fields: { id: expect.stringContaining('รหัสผู้ใช้') } },
    });
    expect(mockedService.listPublicUserRewards).not.toHaveBeenCalled();
  });
});

describe('reward.controller listMyRewards()', () => {
  it('lists rewards of the logged-in user, responds 200', async () => {
    const req = { user: { user_id: 4 } } as unknown as Request;
    const res = makeRes();
    mockedService.listMyRewards.mockResolvedValue([] as never);

    await listMyRewards(req, res);

    expect(mockedService.listMyRewards).toHaveBeenCalledWith(4);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
  });
});

describe('reward.controller setMyRewardDisplayed()', () => {
  it.each([true, false])('passes user id, reward id and isDisplayed=%s to the service', async (isDisplayed) => {
    const req = { params: { id: '15' }, user: { user_id: 4 }, body: { isDisplayed } } as unknown as Request;
    const res = makeRes();
    const result = { reward_id: 15, is_displayed: isDisplayed };
    mockedService.setMyRewardDisplayed.mockResolvedValue(result as never);

    await setMyRewardDisplayed(req, res);

    expect(mockedService.setMyRewardDisplayed).toHaveBeenCalledWith(4, 15, isDisplayed);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  it('rejects a bad reward id with the reward label', async () => {
    const req = { params: { id: '0' }, user: { user_id: 4 }, body: { isDisplayed: true } } as unknown as Request;
    await expect(setMyRewardDisplayed(req, makeRes())).rejects.toMatchObject({
      ...badId,
      extra: { fields: { id: expect.stringContaining('รหัสรางวัล') } },
    });
    expect(mockedService.setMyRewardDisplayed).not.toHaveBeenCalled();
  });

  it('propagates a service error (e.g. reward not owned)', async () => {
    const req = { params: { id: '15' }, user: { user_id: 4 }, body: { isDisplayed: true } } as unknown as Request;
    const err = new Error('NOT_OWNED');
    mockedService.setMyRewardDisplayed.mockRejectedValue(err);
    await expect(setMyRewardDisplayed(req, makeRes())).rejects.toBe(err);
  });
});

describe('reward.controller redeemReward()', () => {
  it('redeems the reward in the path for the logged-in user, responds 200', async () => {
    const req = { params: { id: '15' }, user: { user_id: 4 } } as unknown as Request;
    const res = makeRes();
    const result = { reward_id: 15, points_left: 20 };
    mockedService.redeemReward.mockResolvedValue(result as never);

    await redeemReward(req, res);

    expect(mockedService.redeemReward).toHaveBeenCalledWith(4, 15);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  it('rejects a bad reward id without spending anything', async () => {
    const req = { params: { id: '-3' }, user: { user_id: 4 } } as unknown as Request;
    await expect(redeemReward(req, makeRes())).rejects.toMatchObject(badId);
    expect(mockedService.redeemReward).not.toHaveBeenCalled();
  });

  it('propagates a service error (e.g. not enough points)', async () => {
    const req = { params: { id: '15' }, user: { user_id: 4 } } as unknown as Request;
    const err = new Error('INSUFFICIENT_POINTS');
    mockedService.redeemReward.mockRejectedValue(err);
    await expect(redeemReward(req, makeRes())).rejects.toBe(err);
  });
});
