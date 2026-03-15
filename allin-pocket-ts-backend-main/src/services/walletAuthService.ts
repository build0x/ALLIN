import crypto from 'crypto';
import {ethers} from 'ethers';
import {WalletNonce} from '../database/models/walletNonce';
import {User} from '../database/models/user';
import {allinConfig} from '../allinConfig';

const normalizeWallet = (walletAddress: string) => ethers.getAddress(walletAddress).toLowerCase();

const buildMessage = (walletAddress: string, nonce: string) => {
  return [
    `${allinConfig.wallet.messageDomain} 钱包登录`,
    `地址: ${walletAddress}`,
    `Nonce: ${nonce}`,
    `ChainId: ${allinConfig.wallet.chainId}`,
    '说明: 签名仅用于登录，不会发起链上交易。',
  ].join('\n');
};

export const createWalletNonce = async (walletAddress: string) => {
  const normalizedWallet = normalizeWallet(walletAddress);
  const nonce = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + allinConfig.wallet.nonceExpiresMinutes * 60 * 1000);

  await WalletNonce.update(
    {consumed: true},
    {where: {wallet_address: normalizedWallet, consumed: false}}
  );

  const walletNonce = await WalletNonce.create({
    wallet_address: normalizedWallet,
    nonce,
    expires_at: expiresAt,
  });

  return {
    nonce: walletNonce.nonce,
    walletAddress: normalizedWallet,
    message: buildMessage(normalizedWallet, walletNonce.nonce),
    expiresAt,
  };
};

export const verifyWalletLogin = async (walletAddress: string, signature: string) => {
  const normalizedWallet = normalizeWallet(walletAddress);
  const walletNonce = await WalletNonce.findOne({
    where: {
      wallet_address: normalizedWallet,
      consumed: false,
    },
    order: [['created_at', 'DESC']],
  });

  if (!walletNonce) {
    throw new Error('WALLET_NONCE_NOT_FOUND');
  }

  if (walletNonce.expires_at.getTime() < Date.now()) {
    throw new Error('WALLET_NONCE_EXPIRED');
  }

  const message = buildMessage(normalizedWallet, walletNonce.nonce);
  const recoveredWallet = ethers.verifyMessage(message, signature).toLowerCase();

  if (recoveredWallet !== normalizedWallet) {
    throw new Error('WALLET_SIGNATURE_INVALID');
  }

  walletNonce.consumed = true;
  await walletNonce.save();

  let user = await User.findOne({where: {wallet_address: normalizedWallet}});
  if (!user) {
    const suffix = normalizedWallet.slice(-6);
    user = await User.create({
      username: `allin_${suffix}`,
      avatar_icon: 'joker',
      email: `${suffix}@wallet.allin`,
      password: null,
      wallet_address: normalizedWallet,
      login_method: 'wallet',
      money: 0,
      allin_balance: 0,
    });
  } else if (user.login_method !== 'wallet') {
    user.login_method = 'wallet';
    user.wallet_address = normalizedWallet;
    await user.save();
  }

  return {
    user,
    nonce: walletNonce.nonce,
    message,
  };
};
