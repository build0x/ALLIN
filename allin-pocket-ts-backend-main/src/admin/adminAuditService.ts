import {AdminAuditLog} from '../database/models/adminAuditLog';

export interface AdminAuditInput {
  adminWalletId?: number | null;
  adminWalletAddress: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  targetUserId?: number | null;
  httpMethod?: string | null;
  path?: string | null;
  ipAddress?: string | null;
  summary?: string | null;
  payload?: Record<string, unknown> | null;
}

export const createAdminAuditLog = async (input: AdminAuditInput) =>
  AdminAuditLog.create({
    admin_wallet_id: input.adminWalletId || null,
    admin_wallet_address: input.adminWalletAddress,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId || null,
    target_user_id: input.targetUserId || null,
    http_method: input.httpMethod || null,
    path: input.path || null,
    ip_address: input.ipAddress || null,
    summary: input.summary || null,
    payload: input.payload || null,
  });
