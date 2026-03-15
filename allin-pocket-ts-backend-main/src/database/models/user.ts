import bcrypt from 'bcrypt';
import {
  AllowNull,
  AutoIncrement,
  BeforeCreate,
  BeforeUpdate,
  Column,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
  Unique
} from 'sequelize-typescript';

@Table({
  tableName: 'users',
  timestamps: true,
})
export class User extends Model {

  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @Unique
  @AllowNull(true)
  @Column(DataType.STRING)
  username!: string | null;

  @AllowNull(true)
  @Default('♠')
  @Column(DataType.STRING)
  avatar_icon!: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  password!: string | null;

  @Unique
  @AllowNull(true)
  @Column(DataType.STRING)
  email!: string | null;

  @Unique
  @AllowNull(true)
  @Column(DataType.STRING)
  wallet_address!: string | null;

  @AllowNull(false)
  @Default('password')
  @Column(DataType.STRING)
  login_method!: string;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  xp!: number;
  
  @Column({
    type: DataType.DECIMAL,
    defaultValue: 0,
  })
  money!: number;

  @Column({
    type: DataType.DECIMAL(36, 18),
    defaultValue: 0,
  })
  allin_balance!: number;

  @Column({
    type: DataType.DECIMAL(36, 18),
    defaultValue: 0,
  })
  lifetime_burned!: number;

  @Column({
    type: DataType.DECIMAL(36, 18),
    defaultValue: 0,
  })
  total_deposited!: number;

  @Column({
    type: DataType.DECIMAL(36, 18),
    defaultValue: 0,
  })
  total_withdrawn!: number;

  @Column({
    type: DataType.DECIMAL(36, 18),
    defaultValue: 0,
  })
  locked_table_balance!: number;

  @Column({
    type: DataType.DECIMAL(36, 18),
    defaultValue: 0,
  })
  locked_tournament_balance!: number;

  @Column({
    type: DataType.DECIMAL(36, 18),
    defaultValue: 0,
  })
  pending_withdrawal!: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  play_count!: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  win_count!: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  lose_count!: number;

  @BeforeCreate
  @BeforeUpdate
  static async hashPassword(user: User) {
    if (user.password && user.changed('password')) {
      user.password = await bcrypt.hash(user.password, 10); // salt rounds = 10
    }
  }

}
