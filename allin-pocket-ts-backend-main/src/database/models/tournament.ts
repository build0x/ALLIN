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
  tableName: 'tournaments',
  timestamps: true,
})
export class Tournament extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  slug!: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  tier!: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  title!: string;

  @AllowNull(false)
  @Default('scheduled')
  @Column(DataType.STRING)
  status!: string;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.DECIMAL(36, 18))
  required_hold_amount!: number;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.DECIMAL(36, 18))
  buy_in_allin!: number;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.DECIMAL(36, 18))
  burn_amount!: number;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.DECIMAL(36, 18))
  bnb_prize_amount!: number;

  @AllowNull(false)
  @Default(2)
  @Column(DataType.INTEGER)
  min_players!: number;

  @AllowNull(false)
  @Default(6)
  @Column(DataType.INTEGER)
  max_players!: number;

  @AllowNull(true)
  @Column(DataType.DATE)
  registration_opens_at!: Date | null;

  @AllowNull(true)
  @Column(DataType.DATE)
  starts_at!: Date | null;

  @AllowNull(true)
  @Column(DataType.DATE)
  finished_at!: Date | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  metadata!: Record<string, unknown> | null;

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}
