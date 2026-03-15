import {Op} from 'sequelize';
import {sequelize} from '../database/database';
import {UserTable} from '../database/models/userTables';
import {User} from '../database/models/user';
import {AdminWallet} from '../database/models/adminWallet';
import {removeRuntimeUserTableByDatabaseId} from '../games/gameHandler';
import {createAdminAuditLog} from './adminAuditService';

const toNumber = (value: unknown) => Number(value || 0);

export const listAdminRooms = async (search: string) => {
  const normalizedSearch = String(search || '').trim();
  const roomWhere = normalizedSearch
    ? {
        [Op.or]: [
          {tableName: {[Op.iLike]: `%${normalizedSearch}%`}},
          {roomType: {[Op.iLike]: `%${normalizedSearch}%`}},
        ],
      }
    : undefined;

  const rooms = await UserTable.findAll({
    where: roomWhere,
    order: [['createdAt', 'DESC']],
  });

  const userIds = Array.from(new Set(rooms.map((room) => Number(room.userId || 0)).filter(Boolean)));
  const users = userIds.length
    ? await User.findAll({
        where: {
          id: {
            [Op.in]: userIds,
          },
        },
      })
    : [];
  const userMap = new Map(users.map((user) => [Number(user.id), user]));

  return {
    total: rooms.length,
    items: rooms.map((room) => {
      const owner = userMap.get(Number(room.userId));
      const burnAmount = toNumber(room.burnAmount);
      const durationHours = Math.max(1, burnAmount > 0 ? Math.round(burnAmount / 10000) : 1);
      return {
        id: Number(room.id),
        tableName: room.tableName,
        roomType: room.roomType || 'cash',
        game: room.game,
        userId: Number(room.userId),
        ownerName: owner?.username || '-',
        ownerWalletAddress: owner?.wallet_address || '-',
        maxSeats: Number(room.maxSeats || 0),
        minBet: toNumber(room.minBet),
        passwordProtected: Boolean(String(room.password || '').length),
        burnAmount,
        durationHours,
        expiresAt: room.expiresAt,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
        isExpired: room.expiresAt ? new Date(room.expiresAt).getTime() <= Date.now() : false,
      };
    }),
  };
};

interface DeleteAdminRoomInput {
  roomId: number;
  adminWallet: AdminWallet;
  ipAddress?: string;
  path?: string;
  httpMethod?: string;
}

export const deleteAdminRoom = async (input: DeleteAdminRoomInput) => {
  return sequelize.transaction(async (transaction) => {
    const room = await UserTable.findOne({
      where: {
        id: input.roomId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!room) {
      throw new Error('ROOM_NOT_FOUND');
    }

    const owner = await User.findOne({
      where: {
        id: room.userId,
      },
      transaction,
    });

    await room.destroy({transaction});

    removeRuntimeUserTableByDatabaseId(
      Number(input.roomId),
      '该亲友房已被后台删除，请返回大厅重新选择房间'
    );

    await createAdminAuditLog({
      adminWalletId: input.adminWallet.id,
      adminWalletAddress: input.adminWallet.wallet_address,
      action: 'room.delete',
      resourceType: 'room',
      resourceId: String(room.id),
      targetUserId: Number(room.userId || 0) || null,
      httpMethod: input.httpMethod,
      path: input.path,
      ipAddress: input.ipAddress,
      summary: `删除房间 ${room.tableName}`,
      payload: {
        roomId: Number(room.id),
        tableName: room.tableName,
        roomType: room.roomType,
        ownerUserId: Number(room.userId),
        ownerWalletAddress: owner?.wallet_address || null,
      },
    });

    return {
      id: Number(room.id),
      tableName: room.tableName,
      roomType: room.roomType || 'cash',
      userId: Number(room.userId),
    };
  });
};
