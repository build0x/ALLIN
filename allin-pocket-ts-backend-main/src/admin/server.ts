import cors from 'cors';
import express, {Request, Response} from 'express';
import {createAdminNonce, seedAdminWallets, verifyAdminWalletLogin} from './adminAuthService';
import {attachAdminAudit, adminRateLimit, getIpAddress, handleAdminError, requireAdminAuth} from './middleware';
import {getAdminDashboardData, listAdminAuditLogs} from './adminDashboardService';
import {adjustAdminUserBalances, getAdminUserDetails, listAdminUsers} from './adminUserService';
import {
  adminApplyTournamentStrategy,
  adminAdvanceTournament,
  adminCancelTournamentRegistration,
  adminFillTournamentBots,
  adminGenerateTournamentStrategy,
  adminRejectTournamentStrategy,
  adminRegisterTournamentUser,
  adminResetTournament,
  getAdminTournamentDetails,
  listAdminTournaments,
  updateAdminTournament
} from './adminTournamentService';
import {deleteAdminRoom, listAdminRooms} from './adminRoomService';

const parsePage = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const createAdminApp = () => {
  const app = express();

  app.use(cors({origin: true, credentials: true}));
  app.use(express.json({limit: '1mb'}));

  app.get('/health', (_request, response) => {
    response.json({
      success: true,
      service: 'allin-admin-api',
    });
  });

  app.get('/', (_request, response) => {
    response.json({
      success: true,
      message: 'ALLIN 后端已运行。请启动前端项目 (poker-pocket-react-client) 并在浏览器打开前端地址（如 http://localhost:3000）使用扑克应用。',
      endpoints: { health: '/health', adminApi: '/admin-api', websocket: '/api' },
    });
  });

  app.post('/admin-api/auth/nonce', adminRateLimit(20, 60 * 1000), async (request, response, next) => {
    try {
      const result = await createAdminNonce(String(request.body.walletAddress || ''));
      response.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/admin-api/auth/verify', adminRateLimit(20, 60 * 1000), async (request, response, next) => {
    try {
      const result = await verifyAdminWalletLogin(
        String(request.body.walletAddress || ''),
        String(request.body.signature || '')
      );
      response.json({
        success: true,
        data: {
          token: result.token,
          admin: {
            id: result.adminWallet.id,
            walletAddress: result.adminWallet.wallet_address,
            displayName: result.adminWallet.display_name,
            role: result.adminWallet.role,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/admin-api', (_request, response) => {
    response.json({
      success: true,
      message: 'ALLIN 后台接口已启动，请访问前端后台页面 /admin/login 进行登录。',
      endpoints: {
        health: '/health',
        loginPage: '/admin/login',
        authNonce: '/admin-api/auth/nonce',
        authVerify: '/admin-api/auth/verify',
      },
    });
  });

  app.use('/admin-api', requireAdminAuth, attachAdminAudit);

  app.get('/admin-api/auth/me', async (request: Request & {adminWallet?: any}, response) => {
    response.json({
      success: true,
      data: {
        admin: {
          id: request.adminWallet.id,
          walletAddress: request.adminWallet.wallet_address,
          displayName: request.adminWallet.display_name,
          role: request.adminWallet.role,
        },
      },
    });
  });

  app.get('/admin-api/dashboard', async (_request, response, next) => {
    try {
      const data = await getAdminDashboardData();
      response.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/admin-api/users', async (request, response, next) => {
    try {
      const data = await listAdminUsers(
        String(request.query.search || ''),
        parsePage(request.query.page, 1),
        parsePage(request.query.pageSize, 20)
      );
      response.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/admin-api/users/:id', async (request, response, next) => {
    try {
      const data = await getAdminUserDetails(Number(request.params.id));
      response.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/admin-api/users/:id/balance-adjust', adminRateLimit(30, 60 * 1000), async (request: Request & {
    adminWallet?: any;
  }, response: Response, next) => {
    try {
      const data = await adjustAdminUserBalances({
        userId: Number(request.params.id),
        moneyDelta: Number(request.body.moneyDelta || 0),
        allinDelta: Number(request.body.allinDelta || 0),
        reason: String(request.body.reason || ''),
        adminWallet: request.adminWallet,
        ipAddress: getIpAddress(request),
        path: request.path,
        httpMethod: request.method,
      });
      response.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/admin-api/tournaments', async (_request, response, next) => {
    try {
      const data = await listAdminTournaments();
      response.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/admin-api/rooms', async (request, response, next) => {
    try {
      const data = await listAdminRooms(String(request.query.search || ''));
      response.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/admin-api/rooms/:id', adminRateLimit(30, 60 * 1000), async (request: Request & {
    adminWallet?: any;
  }, response, next) => {
    try {
      const data = await deleteAdminRoom({
        roomId: Number(request.params.id),
        adminWallet: request.adminWallet,
        ipAddress: getIpAddress(request),
        path: request.path,
        httpMethod: request.method,
      });
      response.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/admin-api/tournaments/:id', async (request, response, next) => {
    try {
      const data = await getAdminTournamentDetails(Number(request.params.id));
      response.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/admin-api/tournaments/:id', adminRateLimit(30, 60 * 1000), async (request: Request & {
    adminWallet?: any;
  }, response, next) => {
    try {
      const data = await updateAdminTournament({
        tournamentId: Number(request.params.id),
        patch: request.body || {},
        adminWallet: request.adminWallet,
        ipAddress: getIpAddress(request),
        path: request.path,
        httpMethod: request.method,
      });
      response.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/admin-api/tournaments/:id/register/:userId', adminRateLimit(30, 60 * 1000), async (request: Request & {
    adminWallet?: any;
  }, response, next) => {
    try {
      const data = await adminRegisterTournamentUser({
        tournamentId: Number(request.params.id),
        userId: Number(request.params.userId),
        adminWallet: request.adminWallet,
        ipAddress: getIpAddress(request),
        path: request.path,
        httpMethod: request.method,
      });
      response.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post(
    '/admin-api/tournaments/:id/cancel-registration/:userId',
    adminRateLimit(30, 60 * 1000),
    async (request: Request & {adminWallet?: any}, response, next) => {
      try {
        const data = await adminCancelTournamentRegistration({
          tournamentId: Number(request.params.id),
          userId: Number(request.params.userId),
          adminWallet: request.adminWallet,
          ipAddress: getIpAddress(request),
          path: request.path,
          httpMethod: request.method,
        });
        response.json({
          success: true,
          data,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  app.post('/admin-api/tournaments/:id/advance', adminRateLimit(30, 60 * 1000), async (request: Request & {
    adminWallet?: any;
  }, response, next) => {
    try {
      const data = await adminAdvanceTournament({
        tournamentId: Number(request.params.id),
        adminWallet: request.adminWallet,
        ipAddress: getIpAddress(request),
        path: request.path,
        httpMethod: request.method,
      });
      response.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/admin-api/tournaments/:id/reset', adminRateLimit(10, 60 * 1000), async (request: Request & {
    adminWallet?: any;
  }, response, next) => {
    try {
      const data = await adminResetTournament({
        tournamentId: Number(request.params.id),
        adminWallet: request.adminWallet,
        ipAddress: getIpAddress(request),
        path: request.path,
        httpMethod: request.method,
      });
      response.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/admin-api/tournaments/:id/strategy/generate', adminRateLimit(20, 60 * 1000), async (request: Request & {
    adminWallet?: any;
  }, response, next) => {
    try {
      const data = await adminGenerateTournamentStrategy({
        tournamentId: Number(request.params.id),
        adminWallet: request.adminWallet,
        ipAddress: getIpAddress(request),
        path: request.path,
        httpMethod: request.method,
      });
      response.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/admin-api/tournaments/:id/strategy/apply', adminRateLimit(20, 60 * 1000), async (request: Request & {
    adminWallet?: any;
  }, response, next) => {
    try {
      const data = await adminApplyTournamentStrategy({
        tournamentId: Number(request.params.id),
        adminWallet: request.adminWallet,
        ipAddress: getIpAddress(request),
        path: request.path,
        httpMethod: request.method,
      });
      response.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/admin-api/tournaments/:id/strategy/reject', adminRateLimit(20, 60 * 1000), async (request: Request & {
    adminWallet?: any;
  }, response, next) => {
    try {
      const data = await adminRejectTournamentStrategy({
        tournamentId: Number(request.params.id),
        adminWallet: request.adminWallet,
        ipAddress: getIpAddress(request),
        path: request.path,
        httpMethod: request.method,
      });
      response.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/admin-api/tournaments/:id/fill-bots', adminRateLimit(20, 60 * 1000), async (request: Request & {
    adminWallet?: any;
  }, response, next) => {
    try {
      const data = await adminFillTournamentBots({
        tournamentId: Number(request.params.id),
        count: request.body?.count !== undefined ? Number(request.body.count) : undefined,
        adminWallet: request.adminWallet,
        ipAddress: getIpAddress(request),
        path: request.path,
        httpMethod: request.method,
      });
      response.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/admin-api/audit-logs', async (request, response, next) => {
    try {
      const data = await listAdminAuditLogs(
        parsePage(request.query.page, 1),
        parsePage(request.query.pageSize, 20),
        String(request.query.search || '')
      );
      response.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  });

  app.use(handleAdminError);

  return app;
};

export {seedAdminWallets};
