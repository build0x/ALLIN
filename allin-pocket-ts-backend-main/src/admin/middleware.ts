import {NextFunction, Request, Response} from 'express';
import {AdminWallet} from '../database/models/adminWallet';
import {verifyAdminAccessToken} from './adminAuthService';
import {createAdminAuditLog} from './adminAuditService';

interface AdminRequest extends Request {
  adminWallet?: AdminWallet;
  audit?: (data: {
    action: string;
    resourceType: string;
    resourceId?: string | null;
    targetUserId?: number | null;
    summary?: string | null;
    payload?: Record<string, unknown> | null;
  }) => Promise<void>;
}

const requestBucket = new Map<string, {count: number; resetAt: number}>();

export const getIpAddress = (request: Request) =>
  String(request.headers['x-forwarded-for'] || request.socket.remoteAddress || request.ip || '');

export const adminRateLimit = (maxRequests: number, windowMs: number) =>
  (request: Request, response: Response, next: NextFunction) => {
    const key = `${getIpAddress(request)}:${request.path}`;
    const now = Date.now();
    const current = requestBucket.get(key);

    if (!current || current.resetAt < now) {
      requestBucket.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      next();
      return;
    }

    if (current.count >= maxRequests) {
      response.status(429).json({
        success: false,
        message: '请求过于频繁，请稍后再试',
      });
      return;
    }

    current.count += 1;
    requestBucket.set(key, current);
    next();
  };

export const requireAdminAuth = async (request: AdminRequest, response: Response, next: NextFunction) => {
  const authHeader = request.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    response.status(401).json({
      success: false,
      message: '管理员登录已失效',
    });
    return;
  }

  try {
    const payload = verifyAdminAccessToken(token);
    const adminWallet = await AdminWallet.findOne({
      where: {
        id: payload.adminWalletId,
        wallet_address: payload.walletAddress,
        is_active: true,
      },
    });

    if (!adminWallet) {
      response.status(403).json({
        success: false,
        message: '管理员权限不足',
      });
      return;
    }

    request.adminWallet = adminWallet;
    next();
  } catch (error) {
    response.status(401).json({
      success: false,
      message: '管理员登录已失效',
    });
  }
};

export const attachAdminAudit = (request: AdminRequest, _response: Response, next: NextFunction) => {
  request.audit = async ({action, resourceType, resourceId, targetUserId, summary, payload}) => {
    if (!request.adminWallet) {
      return;
    }

    await createAdminAuditLog({
      adminWalletId: request.adminWallet.id,
      adminWalletAddress: request.adminWallet.wallet_address,
      action,
      resourceType,
      resourceId,
      targetUserId,
      summary,
      payload,
      ipAddress: getIpAddress(request),
      path: request.path,
      httpMethod: request.method,
    });
  };
  next();
};

export const handleAdminError = (error: any, _request: Request, response: Response, _next: NextFunction) => {
  const message = error instanceof Error ? error.message : 'UNKNOWN_ADMIN_ERROR';
  const statusMap: Record<string, number> = {
    ADMIN_WALLET_NOT_ALLOWED: 403,
    ADMIN_NONCE_NOT_FOUND: 400,
    ADMIN_NONCE_EXPIRED: 400,
    ADMIN_SIGNATURE_INVALID: 400,
    USER_NOT_FOUND: 404,
    TOURNAMENT_NOT_FOUND: 404,
    ROOM_NOT_FOUND: 404,
    TOURNAMENT_REGISTRATION_NOT_FOUND: 404,
    TOURNAMENT_REGISTRATION_ALREADY_CANCELLED: 400,
    INSUFFICIENT_MONEY_BALANCE: 400,
    INSUFFICIENT_ALLIN_BALANCE: 400,
    ADJUST_REASON_REQUIRED: 400,
    ADJUST_AMOUNT_REQUIRED: 400,
    INVALID_TOURNAMENT_PLAYER_LIMITS: 400,
  };

  response.status(statusMap[message] || 500).json({
    success: false,
    message,
  });
};
