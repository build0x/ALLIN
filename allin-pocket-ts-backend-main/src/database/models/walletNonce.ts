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
  tableName: 'wallet_nonces',
  timestamps: true,
})
export class WalletNonce extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  wallet_address!: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  nonce!: string;

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  consumed!: boolean;

  @AllowNull(false)
  @Column(DataType.DATE)
  expires_at!: Date;

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}
