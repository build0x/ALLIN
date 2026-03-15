import {WebSocketServer} from 'ws';
import logger from './logger';
import {GameHandler} from './games/gameHandler';
import {initializeDatabase} from './database/database';
import {ExtendedWebSocket} from './interfaces';
import {schedule} from 'node-cron';
import {cleanUpExpiredTokens} from './database/queries';
import {progressTournamentLifecycle, seedAllinEconomy} from './services/economyService';
import {createServer} from 'http';
import {createAdminApp, seedAdminWallets} from './admin/server';
import {generateDailyTournamentRewardRecommendations} from './services/oracleStrategyService';
import {runOnchainReconciliationCycle} from './services/onchainEconomyService';

// 捕获未处理的异常，防止 ECONNRESET 等导致进程崩溃
process.on('uncaughtException', (err: Error) => {
  console.error('Uncaught Exception:', err?.message ?? err);
  logger.error('Uncaught Exception:', err);
  // 不退出进程，继续运行
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error('Unhandled Rejection', {reason, promise});
});

const port = Number(process.env.PORT) || 8000;
const app = createAdminApp();
const httpServer = createServer(app);
const server = new WebSocketServer({server: httpServer, path: '/api'});
const gameHandler = new GameHandler();


const launch = async () => {
  await initializeDatabase();
  await seedAdminWallets();
  await seedAllinEconomy();

  await gameHandler.createStartingTables();

  server.on('connection', (socket: ExtendedWebSocket) => {
    gameHandler.onConnection(socket);

    socket.isAlive = true;

    socket.on('pong', () => {
      socket.isAlive = true;
    });

    socket.on('message', (message: string) => {
      gameHandler.onMessage(socket, message);
    });

    socket.on('error', (err: Error) => {
      // ECONNRESET 等连接断开属正常，只记录日志，不抛异常
      logger.warn('Socket error:', err?.message ?? err);
    });

    socket.on('close', () => {
      gameHandler.onClientDisconnected(socket);
    });
  });

  httpServer.listen(port, () => {
    logger.info(`ALLIN backend listening on http://localhost:${port}`);
    logger.info(`WebSocket server is running on ws://localhost:${port}/api`);
    logger.info(`Admin API is running on http://localhost:${port}/admin-api`);
  });
};

launch().catch((error: any) => {
  logger.error('Error starting the application:', error);
  process.exit(1);
});

// Ping clients periodically
const interval = setInterval(() => {
  server.clients.forEach((socket) => {
    const extSocket = socket as ExtendedWebSocket;

    if (!extSocket.isAlive) {
      logger.warn(`Terminating unresponsive client`);
      return extSocket.terminate();
    }

    extSocket.isAlive = false;
    extSocket.ping();
  });
}, 10 * 1000);

server.on('close', () => {
  clearInterval(interval);
});


schedule('0 * * * *', async () => {
  logger.debug(`Cleaning expired tokens`);
  await cleanUpExpiredTokens();
});

schedule('* * * * *', async () => {
  await progressTournamentLifecycle();
});

schedule('*/2 * * * *', async () => {
  await runOnchainReconciliationCycle();
});

schedule('15 2 * * *', async () => {
  await generateDailyTournamentRewardRecommendations();
});
