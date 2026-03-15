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
  tableName: 'burn_records',
  timestamps: true,
})
export class BurnRecord extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  user_id!: number | null;

  @AllowNull(false)
  @Default('game_win')
  @Column(DataType.STRING)
  source_type!: string;

  @AllowNull(false)
  @Column(DataType.DECIMAL(36, 18))
  amount!: number;

  @AllowNull(true)
  @Column(DataType.STRING)
  reference_id!: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  action_id!: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  tx_hash!: string | null;

  @AllowNull(false)
  @Default('confirmed')
  @Column(DataType.STRING)
  status!: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  failure_reason!: string | null;

  @AllowNull(true)
  @Column(DataType.DATE)
  confirmed_at!: Date | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  metadata!: Record<string, unknown> | null;

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}
