import path from 'path';
import {Sequelize} from 'sequelize-typescript';
import logger from '../logger';
import * as dotenv from 'dotenv';
import {User} from './models/user';
import {Achievement} from './models/achievement';
import {Statistic} from './models/statistic';
import {UserTable} from './models/userTables';
import {RefreshToken} from './models/refreshToken';
import {WalletNonce} from './models/walletNonce';
import {PlayerLedger} from './models/playerLedger';
import {EconomySnapshot} from './models/economySnapshot';
import {Tournament} from './models/tournament';
import {TournamentRegistration} from './models/tournamentRegistration';
import {BurnRecord} from './models/burnRecord';
import {AdminWallet} from './models/adminWallet';
import {AdminNonce} from './models/adminNonce';
import {AdminAuditLog} from './models/adminAuditLog';
import {CashierRequest} from './models/cashierRequest';
import {ChainEventCursor} from './models/chainEventCursor';

// 从项目根目录加载 .env（与 dist 同级），避免 PM2 从其他目录启动时读不到
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'poker-pocket-ts',
  // logging: (msg: string) => logger.debug(msg),
  logging: false,
  models: [
    User,
    RefreshToken,
    Achievement,
    Statistic,
    UserTable,
    WalletNonce,
    PlayerLedger,
    EconomySnapshot,
    Tournament,
    TournamentRegistration,
    BurnRecord,
    CashierRequest,
    ChainEventCursor,
    AdminWallet,
    AdminNonce,
    AdminAuditLog,
  ],
  define: {
    schema: 'poker',
  },
});


const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully.');

    await sequelize.sync({alter: true});
  } catch (error) {
    logger.error('Error during database initialization:', error);
    throw new Error(`Database initialization failed: ${error}`);
  }
};

export {sequelize, initializeDatabase};
