import logger from '../logger';
import {Op} from 'sequelize';
import {EconomySnapshot} from '../database/models/economySnapshot';
import {Tournament} from '../database/models/tournament';
import {TournamentRegistration} from '../database/models/tournamentRegistration';

const toNumber = (value: unknown) => Number(value || 0);

export const TOURNAMENT_REWARD_TEMPLATES = [
  {
    code: 'conservative',
    label: '保守档',
    prizeMultiplier: 0.85,
    summary: '优先延长奖池续航，适合报名偏弱或奖池覆盖偏紧时使用。',
  },
  {
    code: 'standard',
    label: '标准档',
    prizeMultiplier: 1,
    summary: '维持当前奖励水平，适合报名和奖池健康度都处于中位区间。',
  },
  {
    code: 'aggressive',
    label: '激进档',
    prizeMultiplier: 1.15,
    summary: '提高奖励吸引力，适合报名较强且奖池覆盖充足时使用。',
  },
] as const;

const DEFAULT_MODEL_PRICE_BNB: Record<number, number> = {
  0: 0.01,
  1: 0.05,
  2: 0.03,
};

const getProviderMode = () => process.env.FLAP_ORACLE_PROVIDER_MODE || 'mock';

const getConfiguredModelId = () => {
  const parsed = Number(process.env.FLAP_ORACLE_MODEL_ID || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getModelPriceBnb = (modelId: number) => DEFAULT_MODEL_PRICE_BNB[modelId] || DEFAULT_MODEL_PRICE_BNB[0];

export const getTournamentStrategyRecommendation = (metadata: Record<string, unknown> | null | undefined) => {
  const recommendation = metadata?.oracleStrategy;
  if (!recommendation || typeof recommendation !== 'object') {
    return null;
  }

  return recommendation as Record<string, unknown>;
};

const getTemplateByCode = (code: string) =>
  TOURNAMENT_REWARD_TEMPLATES.find((item) => item.code === code) || TOURNAMENT_REWARD_TEMPLATES[1];

const buildTournamentPrompt = (params: {
  title: string;
  tier: string;
  currentPrizeBnb: number;
  registrationCount: number;
  maxPlayers: number;
  minPlayers: number;
  requiredHoldAmount: number;
  buyInAllin: number;
  bnbPrizePool: number;
}) => {
  const {
    title,
    tier,
    currentPrizeBnb,
    registrationCount,
    maxPlayers,
    minPlayers,
    requiredHoldAmount,
    buyInAllin,
    bnbPrizePool,
  } = params;

  return [
    'You are advising the ALLIN tournament economy system.',
    `Tournament title: ${title}.`,
    `Tier: ${tier}.`,
    `Current BNB prize: ${currentPrizeBnb}.`,
    `Registrations: ${registrationCount}/${maxPlayers}.`,
    `Minimum players to start: ${minPlayers}.`,
    `Required hold amount: ${requiredHoldAmount} ALLIN.`,
    `Buy-in: ${buyInAllin} ALLIN.`,
    `Current tracked BNB prize pool: ${bnbPrizePool}.`,
    'Choose one reward template only:',
    '0 = conservative reward template',
    '1 = standard reward template',
    '2 = aggressive reward template',
    'Respond with only the number of your choice.',
  ].join(' ');
};

const chooseTemplateCode = (params: {
  registrationCount: number;
  maxPlayers: number;
  currentPrizeBnb: number;
  bnbPrizePool: number;
}) => {
  const registrationRatio =
    params.maxPlayers > 0 ? params.registrationCount / params.maxPlayers : 0;
  const poolCoverage =
    params.currentPrizeBnb > 0 ? params.bnbPrizePool / params.currentPrizeBnb : 0;

  if (poolCoverage < 8 || registrationRatio < 0.34) {
    return 'conservative';
  }

  if (poolCoverage > 18 && registrationRatio >= 0.7) {
    return 'aggressive';
  }

  return 'standard';
};

const buildRecommendationSummary = (params: {
  templateLabel: string;
  registrationCount: number;
  maxPlayers: number;
  bnbPrizePool: number;
  currentPrizeBnb: number;
}) => {
  const registrationRatio =
    params.maxPlayers > 0 ? ((params.registrationCount / params.maxPlayers) * 100).toFixed(0) : '0';
  const poolCoverage =
    params.currentPrizeBnb > 0 ? (params.bnbPrizePool / params.currentPrizeBnb).toFixed(2) : '0.00';

  return `${params.templateLabel}：当前报名率 ${registrationRatio}% ，奖池覆盖约 ${poolCoverage} 倍当前单场奖励。`;
};

const buildTournamentRecommendationPayload = async (tournament: Tournament) => {
  const [snapshot, registrations] = await Promise.all([
    EconomySnapshot.findOne({
      where: {
        snapshot_key: 'global',
      },
    }),
    TournamentRegistration.findAll({
      where: {
        tournament_id: tournament.id,
      },
    }),
  ]);

  const activeRegistrationCount = registrations.filter((item) => item.status !== 'cancelled').length;
  const currentPrizeBnb = toNumber(tournament.bnb_prize_amount);
  const bnbPrizePool = toNumber(snapshot?.bnb_prize_pool);
  const templateCode = chooseTemplateCode({
    registrationCount: activeRegistrationCount,
    maxPlayers: tournament.max_players,
    currentPrizeBnb,
    bnbPrizePool,
  });
  const template = getTemplateByCode(templateCode);
  const modelId = getConfiguredModelId();
  const nextPrizeAmount = Number((currentPrizeBnb * template.prizeMultiplier).toFixed(4));

  return {
    strategyType: 'tournament_reward_template',
    provider: 'flap-ai-oracle',
    providerMode: getProviderMode(),
    modelId,
    estimatedCostBnb: getModelPriceBnb(modelId),
    promptPreview: buildTournamentPrompt({
      title: tournament.title,
      tier: tournament.tier,
      currentPrizeBnb,
      registrationCount: activeRegistrationCount,
      maxPlayers: tournament.max_players,
      minPlayers: tournament.min_players,
      requiredHoldAmount: toNumber(tournament.required_hold_amount),
      buyInAllin: toNumber(tournament.buy_in_allin),
      bnbPrizePool,
    }),
    templateCode: template.code,
    templateLabel: template.label,
    templateSummary: template.summary,
    recommendedPatch: {
      bnbPrizeAmount: nextPrizeAmount,
    },
    decisionSummary: buildRecommendationSummary({
      templateLabel: template.label,
      registrationCount: activeRegistrationCount,
      maxPlayers: tournament.max_players,
      bnbPrizePool,
      currentPrizeBnb,
    }),
    reasoningCid: null,
    requestId: null,
    status: 'recommended',
    generatedAt: new Date().toISOString(),
    inputs: {
      registrationCount: activeRegistrationCount,
      maxPlayers: tournament.max_players,
      minPlayers: tournament.min_players,
      currentPrizeBnb,
      bnbPrizePool,
      requiredHoldAmount: toNumber(tournament.required_hold_amount),
      buyInAllin: toNumber(tournament.buy_in_allin),
    },
  };
};

export const generateTournamentRewardRecommendation = async (tournamentId: number) => {
  const tournament = await Tournament.findOne({
    where: {
      id: tournamentId,
    },
  });

  if (!tournament) {
    throw new Error('TOURNAMENT_NOT_FOUND');
  }

  const recommendation = await buildTournamentRecommendationPayload(tournament);
  tournament.metadata = {
    ...(tournament.metadata || {}),
    oracleStrategy: recommendation,
  };
  await tournament.save();
  logger.info(`Oracle strategy recommendation generated for tournament ${tournament.id}`);

  return recommendation;
};

export const generateDailyTournamentRewardRecommendations = async () => {
  const tournaments = await Tournament.findAll({
    where: {
      status: {
        [Op.in]: ['scheduled', 'active'],
      },
    },
    order: [['id', 'ASC']],
  });

  for (const tournament of tournaments) {
    const currentRecommendation = getTournamentStrategyRecommendation(tournament.metadata);
    const lastGeneratedAt =
      typeof currentRecommendation?.generatedAt === 'string'
        ? new Date(String(currentRecommendation.generatedAt)).getTime()
        : 0;
    const isFresh = lastGeneratedAt > Date.now() - 20 * 60 * 60 * 1000;

    if (isFresh && currentRecommendation?.status === 'recommended') {
      continue;
    }

    const recommendation = await buildTournamentRecommendationPayload(tournament);
    tournament.metadata = {
      ...(tournament.metadata || {}),
      oracleStrategy: recommendation,
    };
    await tournament.save();
  }
};

export const applyTournamentRewardRecommendation = async (tournamentId: number) => {
  const tournament = await Tournament.findOne({
    where: {
      id: tournamentId,
    },
  });

  if (!tournament) {
    throw new Error('TOURNAMENT_NOT_FOUND');
  }

  const recommendation = getTournamentStrategyRecommendation(tournament.metadata);
  if (!recommendation || recommendation.status !== 'recommended') {
    throw new Error('TOURNAMENT_STRATEGY_RECOMMENDATION_NOT_READY');
  }

  const recommendedPatch = recommendation.recommendedPatch as {bnbPrizeAmount?: number} | undefined;
  if (recommendedPatch?.bnbPrizeAmount === undefined) {
    throw new Error('TOURNAMENT_STRATEGY_PATCH_INVALID');
  }

  tournament.bnb_prize_amount = Number(recommendedPatch.bnbPrizeAmount);
  tournament.metadata = {
    ...(tournament.metadata || {}),
    oracleStrategy: {
      ...recommendation,
      status: 'adopted',
      adoptedAt: new Date().toISOString(),
    },
  };
  await tournament.save();

  return getTournamentStrategyRecommendation(tournament.metadata);
};

export const rejectTournamentRewardRecommendation = async (tournamentId: number) => {
  const tournament = await Tournament.findOne({
    where: {
      id: tournamentId,
    },
  });

  if (!tournament) {
    throw new Error('TOURNAMENT_NOT_FOUND');
  }

  const recommendation = getTournamentStrategyRecommendation(tournament.metadata);
  if (!recommendation || recommendation.status !== 'recommended') {
    throw new Error('TOURNAMENT_STRATEGY_RECOMMENDATION_NOT_READY');
  }

  tournament.metadata = {
    ...(tournament.metadata || {}),
    oracleStrategy: {
      ...recommendation,
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
    },
  };
  await tournament.save();

  return getTournamentStrategyRecommendation(tournament.metadata);
};
