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
  tableName: 'player_ledger',
  timestamps: true,
})
export class PlayerLedger extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  user_id!: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  entry_type!: string;

  @AllowNull(false)
  @Default('ALLIN')
  @Column(DataType.STRING)
  asset!: string;

  @AllowNull(false)
  @Column(DataType.DECIMAL(36, 18))
  amount!: number;

  @AllowNull(false)
  @Column(DataType.DECIMAL(36, 18))
  balance_after!: number;

  @AllowNull(true)
  @Column(DataType.STRING)
  reference_id!: string | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  metadata!: Record<string, unknown> | null;

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}
