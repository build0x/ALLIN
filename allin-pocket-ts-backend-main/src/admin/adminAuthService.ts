import crypto from 'crypto';
import jwt, {JwtPayload} from 'jsonwebtoken';
import {ethers} from 'ethers';
import {AdminNonce} from '../database/models/adminNonce';
import {AdminWallet} from '../database/models/adminWallet';

const adminTokenSecret = process.env.ADMIN_JWT_SECRET || process.env.PW_SECRET || 'allin-admin-secret';
const adminWalletLoginTtlHours = Number(process.env.ADMIN_LOGIN_TTL_HOURS || 12);
const adminNonceExpiresMinutes = Number(process.env.ADMIN_NONCE_EXPIRES_MINUTES || 10);

export interface AdminAccessPayload extends JwtPayload {
  adminWalletId: number;
  walletAddress: string;
  role: string;
  kind: 'admin';
}

const normalizeWallet = (walletAddress: string) => ethers.getAddress(walletAddress).toLowerCase();

const buildAdminMessage = (walletAddress: string, nonce: string) =>
  [
    'ALLIN 管理后台登录',
    `地址: ${walletAddress}`,
    `Nonce: ${nonce}`,
    '说明: 签名仅用于后台身份验证，不会发起链上交易。',
  ].join('\n');

const parseEnvWhitelist = () =>
  String(process.env.ADMIN_WALLETS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => normalizeWallet(item));

export const seedAdminWallets = async () => {
  const envWallets = parseEnvWhitelist();

  for (const walletAddress of envWallets) {
    const existing = await AdminWallet.findOne({
      where: {
        wallet_address: walletAddress,
      },
    });

    if (!existing) {
      await AdminWallet.create({
        wallet_address: walletAddress,
        display_name: `管理员 ${walletAddress.slice(-6)}`,
        role: 'super_admin',
        is_active: true,
        metadata: {
          source: 'env',
        },
      });
    } else if (!existing.is_active) {
      existing.is_active = true;
      await existing.save();
    }
  }
};

export const createAdminNonce = async (walletAddress: string) => {
  const normalizedWallet = normalizeWallet(walletAddress);
  const adminWallet = await AdminWallet.findOne({
    where: {
      wallet_address: normalizedWallet,
      is_active: true,
    },
  });

  if (!adminWallet) {
    throw new Error('ADMIN_WALLET_NOT_ALLOWED');
  }

  await AdminNonce.update(
    {consumed: true},
    {
      where: {
        wallet_address: normalizedWallet,
        consumed: false,
      },
    }
  );

  const nonce = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + adminNonceExpiresMinutes * 60 * 1000);
  const adminNonce = await AdminNonce.create({
    wallet_address: normalizedWallet,
    nonce,
    expires_at: expiresAt,
  });

  return {
    walletAddress: normalizedWallet,
    nonce: adminNonce.nonce,
    message: buildAdminMessage(normalizedWallet, adminNonce.nonce),
    expiresAt,
  };
};

export const createAdminAccessToken = (adminWallet: AdminWallet) =>
  jwt.sign(
    {
      adminWalletId: adminWallet.id,
      walletAddress: adminWallet.wallet_address,
      role: adminWallet.role,
      kind: 'admin',
    },
    adminTokenSecret,
    {
      expiresIn: `${adminWalletLoginTtlHours}h`,
    }
  );

export const verifyAdminAccessToken = (token: string) =>
  jwt.verify(token, adminTokenSecret) as AdminAccessPayload;

export const verifyAdminWalletLogin = async (walletAddress: string, signature: string) => {
  const normalizedWallet = normalizeWallet(walletAddress);
  const adminWallet = await AdminWallet.findOne({
    where: {
      wallet_address: normalizedWallet,
      is_active: true,
    },
  });

  if (!adminWallet) {
    throw new Error('ADMIN_WALLET_NOT_ALLOWED');
  }

  const adminNonce = await AdminNonce.findOne({
    where: {
      wallet_address: normalizedWallet,
      consumed: false,
    },
    order: [['created_at', 'DESC']],
  });

  if (!adminNonce) {
    throw new Error('ADMIN_NONCE_NOT_FOUND');
  }

  if (adminNonce.expires_at.getTime() < Date.now()) {
    throw new Error('ADMIN_NONCE_EXPIRED');
  }

  const message = buildAdminMessage(normalizedWallet, adminNonce.nonce);
  const recoveredWallet = ethers.verifyMessage(message, signature).toLowerCase();
  if (recoveredWallet !== normalizedWallet) {
    throw new Error('ADMIN_SIGNATURE_INVALID');
  }

  adminNonce.consumed = true;
  await adminNonce.save();

  return {
    adminWallet,
    token: createAdminAccessToken(adminWallet),
    message,
  };
};
