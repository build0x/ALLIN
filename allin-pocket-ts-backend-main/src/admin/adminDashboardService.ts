import {Op} from 'sequelize';
import {AdminAuditLog} from '../database/models/adminAuditLog';
import {AdminWallet} from '../database/models/adminWallet';
import {EconomySnapshot} from '../database/models/economySnapshot';
import {Tournament} from '../database/models/tournament';
import {User} from '../database/models/user';

const toNumber = (value: unknown) => Number(value || 0);

export const getAdminDashboardData = async () => {
  const [snapshot, usersCount, adminCount, tournaments, recentAudits, topUsers] = await Promise.all([
    EconomySnapshot.findOne({
      where: {
        snapshot_key: 'global',
      },
    }),
    User.count(),
    AdminWallet.count({
      where: {
        is_active: true,
      },
    }),
    Tournament.findAll({
      where: {
        slug: 'allin-championship',
      },
      order: [['starts_at', 'ASC']],
      limit: 10,
    }),
    AdminAuditLog.findAll({
      order: [['created_at', 'DESC']],
      limit: 10,
    }),
    User.findAll({
      order: [['allin_balance', 'DESC']],
      limit: 5,
      where: {
        wallet_address: {
          [Op.ne]: null,
        },
      },
    }),
  ]);

  return {
    summary: {
      totalUsers: usersCount,
      activeAdmins: adminCount,
      prizePoolBnb: toNumber(snapshot?.bnb_prize_pool),
      totalBurnedAllin: toNumber(snapshot?.allin_burned_total),
      activeCashTables: Number(snapshot?.active_cash_tables || 0),
      activeTournaments: Number(snapshot?.active_tournaments || 0),
    },
    tournaments: tournaments.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      startsAt: item.starts_at,
      bnbPrizeAmount: toNumber(item.bnb_prize_amount),
      buyInAllin: toNumber(item.buy_in_allin),
    })),
    recentAudits: recentAudits.map((item) => ({
      id: item.id,
      action: item.action,
      summary: item.summary,
      adminWalletAddress: item.admin_wallet_address,
      createdAt: item.created_at,
    })),
    topUsers: topUsers.map((item) => ({
      id: item.id,
      username: item.username,
      walletAddress: item.wallet_address,
      allinBalance: toNumber(item.allin_balance),
      money: toNumber(item.money),
    })),
  };
};

export const listAdminAuditLogs = async (page: number, pageSize: number, search: string) => {
  const where = search
    ? {
        [Op.or]: [
          {action: {[Op.iLike]: `%${search}%`}},
          {resource_type: {[Op.iLike]: `%${search}%`}},
          {admin_wallet_address: {[Op.iLike]: `%${search}%`}},
          {summary: {[Op.iLike]: `%${search}%`}},
        ],
      }
    : undefined;

  const {count, rows} = await AdminAuditLog.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    offset: (page - 1) * pageSize,
    limit: pageSize,
  });

  return {
    total: count,
    page,
    pageSize,
    items: rows.map((item) => ({
      id: item.id,
      action: item.action,
      resourceType: item.resource_type,
      resourceId: item.resource_id,
      targetUserId: item.target_user_id,
      summary: item.summary,
      adminWalletAddress: item.admin_wallet_address,
      ipAddress: item.ip_address,
      payload: item.payload,
      createdAt: item.created_at,
    })),
  };
};
