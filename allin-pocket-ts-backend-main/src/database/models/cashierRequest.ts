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
  UpdatedAt,
} from 'sequelize-typescript';

@Table({
  tableName: 'cashier_requests',
  timestamps: true,
})
export class CashierRequest extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  user_id!: number | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  wallet_address!: string | null;

  @AllowNull(false)
  @Default('withdrawal')
  @Column(DataType.STRING)
  direction!: string;

  @AllowNull(false)
  @Default('ALLIN')
  @Column(DataType.STRING)
  asset!: string;

  @AllowNull(false)
  @Column(DataType.DECIMAL(36, 18))
  amount!: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  request_id!: string;

  @AllowNull(false)
  @Default('pending')
  @Column(DataType.STRING)
  status!: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  tx_hash!: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  failure_reason!: string | null;

  @AllowNull(true)
  @Column(DataType.DATE)
  submitted_at!: Date | null;

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
