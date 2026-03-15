import {
  AllowNull,
  AutoIncrement,
  Column,
  CreatedAt,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from 'sequelize-typescript';

@Table({
  tableName: 'tournament_registrations',
  timestamps: true,
})
export class TournamentRegistration extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  tournament_id!: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  user_id!: number;

  @AllowNull(false)
  @Default('registered')
  @Column(DataType.STRING)
  status!: string;

  @AllowNull(false)
  @Default('edition-1')
  @Column(DataType.STRING)
  edition_key!: string;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.DECIMAL(36, 18))
  hold_amount_at_entry!: number;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.DECIMAL(36, 18))
  burn_amount!: number;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  final_rank!: number | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  table_no!: number | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  seat_no!: number | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  elimination_order!: number | null;

  @AllowNull(true)
  @Column(DataType.DATE)
  eliminated_at!: Date | null;

  @AllowNull(true)
  @Column(DataType.DECIMAL(36, 18))
  payout_bnb!: number | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  metadata!: Record<string, unknown> | null;

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}
