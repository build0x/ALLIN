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
  tableName: 'chain_event_cursors',
  timestamps: true,
})
export class ChainEventCursor extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @AllowNull(false)
  @Default('treasury_deposits')
  @Column(DataType.STRING)
  cursor_key!: string;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.BIGINT)
  last_scanned_block!: number;

  @AllowNull(true)
  @Column(DataType.STRING)
  last_tx_hash!: string | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  metadata!: Record<string, unknown> | null;

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}
