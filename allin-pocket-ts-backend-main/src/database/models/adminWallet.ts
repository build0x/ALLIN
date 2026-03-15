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
  Unique,
  UpdatedAt
} from 'sequelize-typescript';

@Table({
  tableName: 'admin_wallets',
  timestamps: true,
})
export class AdminWallet extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @Unique
  @AllowNull(false)
  @Column(DataType.STRING)
  wallet_address!: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  display_name!: string | null;

  @AllowNull(false)
  @Default('super_admin')
  @Column(DataType.STRING)
  role!: string;

  @AllowNull(false)
  @Default(true)
  @Column(DataType.BOOLEAN)
  is_active!: boolean;

  @AllowNull(true)
  @Column(DataType.JSONB)
  metadata!: Record<string, unknown> | null;

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}
