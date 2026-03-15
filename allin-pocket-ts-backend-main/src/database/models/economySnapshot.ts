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
  tableName: 'economy_snapshots',
  timestamps: true,
})
export class EconomySnapshot extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @AllowNull(false)
  @Default('global')
  @Column(DataType.STRING)
  snapshot_key!: string;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.DECIMAL(36, 18))
  bnb_prize_pool!: number;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.DECIMAL(36, 18))
  reserved_bnb_prize_pool!: number;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.DECIMAL(36, 18))
  allin_burned_total!: number;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  active_cash_tables!: number;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  active_tournaments!: number;

  @AllowNull(true)
  @Column(DataType.JSONB)
  metadata!: Record<string, unknown> | null;

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}
