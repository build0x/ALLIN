import {initializeDatabase, sequelize} from './database/database';
import {Tournament} from './database/models/tournament';
import {TournamentRegistration} from './database/models/tournamentRegistration';
import {User} from './database/models/user';
import {BurnRecord} from './database/models/burnRecord';
import {PlayerLedger} from './database/models/playerLedger';

const TOURNAMENT_SLUG = 'allin-championship';
const NEXT_START_DELAY_MS = 30 * 60 * 1000;

const run = async () => {
  await initializeDatabase();

  const tournament = await Tournament.findOne({
    where: {
      slug: TOURNAMENT_SLUG,
    },
  });

  if (!tournament) {
    throw new Error('TOURNAMENT_NOT_FOUND');
  }

  const currentEditionKey = String(tournament.metadata?.currentEditionKey || 'edition-1');

  await sequelize.transaction(async (transaction) => {
    const registrations = await TournamentRegistration.findAll({
      where: {
        tournament_id: tournament.id,
        edition_key: currentEditionKey,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    for (const registration of registrations) {
      const refundAmount = Number(registration.metadata?.buyInAllin || tournament.buy_in_allin || 0);
      const user = await User.findByPk(registration.user_id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!user || refundAmount <= 0) {
        continue;
      }

      user.allin_balance = Number(user.allin_balance || 0) + refundAmount;
      await user.save({transaction});

      await PlayerLedger.create(
        {
          user_id: user.id,
          entry_type: 'tournament_reset_refund',
          asset: 'ALLIN',
          amount: refundAmount,
          balance_after: Number(user.allin_balance || 0),
          reference_id: `tournament-reset:${tournament.id}:${currentEditionKey}`,
          metadata: {
            tournamentId: tournament.id,
            editionKey: currentEditionKey,
            reason: 'reset_dirty_edition',
          },
        },
        {transaction}
      );
    }

    await BurnRecord.destroy({
      where: {
        source_type: 'tournament_registration',
        reference_id: `tournament:${tournament.id}:${currentEditionKey}`,
      },
      transaction,
    });

    await TournamentRegistration.destroy({
      where: {
        tournament_id: tournament.id,
        edition_key: currentEditionKey,
      },
      transaction,
    });

    const nextEditionKey = `edition-${Date.now()}`;
    tournament.status = 'scheduled';
    tournament.finished_at = null;
    tournament.registration_opens_at = new Date();
    tournament.starts_at = new Date(Date.now() + NEXT_START_DELAY_MS);
    tournament.min_players = 60;
    tournament.max_players = 60;
    tournament.metadata = {
      ...(tournament.metadata || {}),
      currentEditionKey: nextEditionKey,
      currentEditionState: null,
      delayedReason: null,
      delayedAt: null,
    };
    await tournament.save({transaction});

    console.log(
      JSON.stringify(
        {
          resetEdition: currentEditionKey,
          nextEdition: nextEditionKey,
          clearedRegistrations: registrations.length,
          refundedUsers: registrations.length,
          startingStack: 1000,
          minBet: 100,
        },
        null,
        2
      )
    );
  });
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[resetDirtyTournamentEdition] failed:', error);
    process.exit(1);
  });
