import {
  AllowNull,
  AutoIncrement,
  Column,
  CreatedAt,
  DataType,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from 'sequelize-typescript';

@Table({
  tableName: 'admin_audit_logs',
  timestamps: true,
})
export class AdminAuditLog extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  admin_wallet_id!: number | null;

  @AllowNull(false)
  @Column(DataType.STRING)
  admin_wallet_address!: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  action!: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  resource_type!: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  resource_id!: string | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  target_user_id!: number | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  http_method!: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  path!: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  ip_address!: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  summary!: string | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  payload!: Record<string, unknown> | null;

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}
