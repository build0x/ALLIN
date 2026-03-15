import React from 'react';
import styled from 'styled-components';

const QUICK_STEPS = [
  '连接钱包并完成签名登录',
  '确认持仓和代币余额满足参与条件',
  '按 1:1 将代币兑换为游戏筹码',
  '进入系统房、亲友房或报名锦标赛',
];

const TOKEN_TERMS = [
  {
    title: 'ALLIN 代币',
    description: '平台核心资产，用于满足持仓门槛、兑换筹码、创建亲友房和报名锦标赛。',
  },
  {
    title: '筹码',
    description: '游戏内使用的对局资产，可由代币按 1:1 兑换，也可等额换回代币。',
  },
  {
    title: '持仓',
    description: '用于判断系统房和锦标赛准入资格的代币持有量，和单纯余额概念不同。',
  },
  {
    title: '锁定中',
    description: '正在牌桌或锦标赛流程中被占用的资产，结算完成后会回到可用状态。',
  },
  {
    title: '累计销毁',
    description: '平台已消耗并永久移除的 ALLIN 总量，常见于亲友房创建等机制。',
  },
];

const FAQ_ITEMS = [
  {
    question: '持仓和代币余额有什么区别？',
    answer:
      '代币余额是你当前钱包或游戏账户里可见的数量，持仓更强调是否达到系统门槛，用于判断能否进入某些房间或赛事。',
  },
  {
    question: '锁定中的资产什么时候释放？',
    answer: '牌局、分桌或赛事结算完成后，锁定资产会随结果回到可用状态或完成结算。',
  },
  {
    question: '筹码可以提现吗？',
    answer:
      '筹码是游戏内资产，不直接提现；需要先在账户页按 1:1 换回代币，再按你的资产管理流程处理。',
  },
  {
    question: '为什么创建亲友房会燃烧 ALLIN？',
    answer:
      '亲友房属于自定义牌桌资源，按小时收取并燃烧 ALLIN，用于控制资源占用并形成代币消耗场景。',
  },
  {
    question: '如何查看锦标赛发奖是否真实发生？',
    answer: '锦标赛历史区域会展示获奖地址与链上交易记录，结算后可以直接核对发奖结果。',
  },
];

const Wrap = styled.div`
  width: min(96vw, 860px);
  max-height: min(90vh, 820px);
  overflow-y: auto;
  padding: 22px 20px 20px;
  border-radius: 24px;
  border: 1px solid rgba(212, 175, 55, 0.22);
  background:
    radial-gradient(circle at top right, rgba(212, 175, 55, 0.14), transparent 34%),
    linear-gradient(160deg, rgba(26, 26, 26, 0.98) 0%, rgba(12, 12, 12, 0.98) 100%);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  color: #f5f5f5;

  @media (max-width: 768px) {
    width: min(96vw, 96vw);
    max-height: min(88vh, 88vh);
    padding: 18px 16px 18px;
    border-radius: 20px;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
`;

const HeaderMain = styled.div`
  min-width: 0;
`;

const Eyebrow = styled.div`
  color: #d4af37;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

const Title = styled.h2`
  margin: 8px 0 0;
  color: #ffffff;
  font-size: 28px;
  font-weight: 800;

  @media (max-width: 768px) {
    font-size: 22px;
  }
`;

const CloseButton = styled.button`
  border: 0;
  background: transparent;
  color: #bfbfbf;
  font-size: 22px;
  line-height: 1;
`;

const IntroCard = styled.div`
  margin-bottom: 18px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid rgba(212, 175, 55, 0.2);
  background: rgba(255, 255, 255, 0.03);
`;

const IntroText = styled.div`
  color: #d8d8d8;
  font-size: 14px;
  line-height: 1.7;
`;

const FlowGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 20px;

  @media (max-width: 768px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const FlowStep = styled.div`
  min-height: 96px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(212, 175, 55, 0.18);
  background: rgba(255, 255, 255, 0.03);
`;

const FlowIndex = styled.div`
  color: #f5d978;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const FlowText = styled.div`
  margin-top: 8px;
  color: #ffffff;
  font-size: 14px;
  line-height: 1.5;
  font-weight: 700;
`;

const Section = styled.section`
  margin-top: 18px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(212, 175, 55, 0.16);
  background: rgba(255, 255, 255, 0.025);
`;

const SectionTitle = styled.h3`
  margin: 0;
  color: #d4af37;
  font-size: 18px;
  font-weight: 800;
`;

const SectionLead = styled.p`
  margin: 10px 0 0;
  color: #d0d0d0;
  font-size: 14px;
  line-height: 1.7;
`;

const Notice = styled.div`
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(212, 175, 55, 0.2);
  background: rgba(212, 175, 55, 0.08);
  color: #fff0bf;
  font-size: 13px;
  line-height: 1.6;
`;

const BulletList = styled.ul`
  margin: 12px 0 0;
  padding-left: 18px;
  color: #f0f0f0;
`;

const BulletItem = styled.li`
  margin-top: 8px;
  line-height: 1.7;

  span {
    color: #f5d978;
    font-weight: 700;
  }
`;

const TermGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const TermCard = styled.div`
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(212, 175, 55, 0.14);
  background: rgba(255, 255, 255, 0.03);
`;

const TermTitle = styled.div`
  color: #ffffff;
  font-size: 15px;
  font-weight: 800;
`;

const TermText = styled.div`
  margin-top: 8px;
  color: #cfcfcf;
  font-size: 13px;
  line-height: 1.6;
`;

const FaqList = styled.div`
  display: grid;
  gap: 10px;
  margin-top: 12px;
`;

const FaqCard = styled.div`
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(212, 175, 55, 0.14);
  background: rgba(255, 255, 255, 0.03);
`;

const FaqQuestion = styled.div`
  color: #ffffff;
  font-size: 14px;
  font-weight: 800;
`;

const FaqAnswer = styled.div`
  margin-top: 8px;
  color: #cfcfcf;
  font-size: 13px;
  line-height: 1.7;
`;

const FooterNote = styled.div`
  margin-top: 18px;
  color: #9f9f9f;
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
`;

const LobbyGuideModal = ({ closeModal }) => {
  return (
    <Wrap>
      <Header>
        <HeaderMain>
          <Eyebrow>ALLIN GUIDE</Eyebrow>
          <Title>玩法说明与代币经济</Title>
        </HeaderMain>
        <CloseButton type="button" aria-label="关闭帮助弹窗" onClick={closeModal}>
          ×
        </CloseButton>
      </Header>

      <IntroCard>
        <IntroText>
          这份说明面向第一次进入大厅的玩家，用来快速理解 ALLIN 的资产流转、
          系统房与亲友房差异、以及锦标赛的参与方式。你可以先看上方流程，再按章节了解细节。
        </IntroText>
      </IntroCard>

      <FlowGrid>
        {QUICK_STEPS.map((item, index) => (
          <FlowStep key={item}>
            <FlowIndex>步骤 {index + 1}</FlowIndex>
            <FlowText>{item}</FlowText>
          </FlowStep>
        ))}
      </FlowGrid>

      <Section>
        <SectionTitle>钱包与登录</SectionTitle>
        <SectionLead>平台当前使用钱包签名完成身份验证，再进入大厅开始游戏。</SectionLead>
        <BulletList>
          <BulletItem>
            <span>支持的钱包：</span>
            当前登录页会检测 MetaMask、OKX 和币安钱包插件，检测到后可直接发起连接。
          </BulletItem>
          <BulletItem>
            <span>登录方式：</span>
            连接钱包后，系统会先下发签名消息，再由钱包完成签名验证身份。
          </BulletItem>
          <BulletItem>
            <span>安全边界：</span>
            签名仅用于登录校验，不会因为登录动作直接触发链上转账。
          </BulletItem>
        </BulletList>
      </Section>

      <Section>
        <SectionTitle>代币经济</SectionTitle>
        <SectionLead>
          大厅里会同时出现代币余额、筹码、持仓和锁定中等字段。它们不是同一个概念，理解清楚后，兑换、入场和报名逻辑会更直观。
        </SectionLead>
        <TermGrid>
          {TOKEN_TERMS.map((item) => (
            <TermCard key={item.title}>
              <TermTitle>{item.title}</TermTitle>
              <TermText>{item.description}</TermText>
            </TermCard>
          ))}
        </TermGrid>
        <Notice>
          账户页支持代币与筹码的 1:1 双向兑换。常见路径是先持有 ALLIN，
          再兑换为筹码入桌；离桌或结算后，可将筹码等额换回代币。
        </Notice>
        <Notice>税费说明：其中 2.5 全部用于锦标赛奖励池，0.5 用于平台营销与日常维护。</Notice>
      </Section>

      <Section>
        <SectionTitle>系统房玩法</SectionTitle>
        <SectionLead>系统房是官方标准牌桌，适合快速入场和按档位选择强度。</SectionLead>
        <BulletList>
          <BulletItem>
            <span>档位规则：</span>
            每个系统房档位都有固定最低下注和持仓门槛，适合不同资金规模的玩家。
          </BulletItem>
          <BulletItem>
            <span>入场判断：</span>
            只有满足对应档位的持仓要求，才能创建或进入该档规则房间。
          </BulletItem>
          <BulletItem>
            <span>房满补建：</span>
            当前档位满桌时，可以一键补建同档规则房间，避免等待。
          </BulletItem>
          <BulletItem>
            <span>快速对局：</span>
            系统房以标准化体验为主，适合想直接开始游戏、不想额外配置参数的玩家。
          </BulletItem>
        </BulletList>
      </Section>

      <Section>
        <SectionTitle>亲友房玩法</SectionTitle>
        <SectionLead>亲友房是自定义私人牌桌，适合邀请朋友按自己的节奏开局。</SectionLead>
        <BulletList>
          <BulletItem>
            <span>可配置项：</span>
            支持设置房名、密码、最低下注、座位数和房间时长。
          </BulletItem>
          <BulletItem>
            <span>燃烧规则：</span>
            按小时消耗 ALLIN，当前规则为 1 小时燃烧 10000 ALLIN，创建成功后立即扣除。
          </BulletItem>
          <BulletItem>
            <span>加入方式：</span>
            创建后会出现在大厅列表，公开房可直接进入，密码房需输入正确密码。
          </BulletItem>
          <BulletItem>
            <span>关闭逻辑：</span>
            房间到时不会中途断局，而是在当前牌局结算完成后自动关闭。
          </BulletItem>
        </BulletList>
      </Section>

      <Section>
        <SectionTitle>锦标赛说明</SectionTitle>
        <SectionLead>锦标赛提供更强的目标感和奖池机制，适合满足门槛后参与阶段性赛事。</SectionLead>
        <BulletList>
          <BulletItem>
            <span>报名条件：</span>
            需要达到持仓门槛，并支付当届报名费后才可进入赛事池。
          </BulletItem>
          <BulletItem>
            <span>赛事机制：</span>
            比赛采用淘汰制，当前筹码降为 0 即淘汰，系统会按进度自动分桌推进。
          </BulletItem>
          <BulletItem>
            <span>升盲节奏：</span>
            大厅会显示当前盲注、级别和下次升盲时间，帮助你判断节奏变化。
          </BulletItem>
          <BulletItem>
            <span>发奖验证：</span>
            赛事结束后会展示获奖地址和链上交易记录，方便核对奖池发放结果。
          </BulletItem>
          <BulletItem>
            <span>奖池来源：</span>
            经济模型中的 2.5 税费会全部注入锦标赛奖励池，另外 0.5 用于平台营销与维护。
          </BulletItem>
        </BulletList>
      </Section>

      <Section>
        <SectionTitle>新手建议</SectionTitle>
        <SectionLead>如果你是第一次进入大厅，建议按下面的顺序体验。</SectionLead>
        <BulletList>
          <BulletItem>
            <span>先看资产：</span>
            先确认账户页中的代币余额、筹码和锁定中状态，避免误判可用资产。
          </BulletItem>
          <BulletItem>
            <span>先从系统房开始：</span>
            系统房门槛和节奏更清晰，适合熟悉大厅逻辑和下注档位。
          </BulletItem>
          <BulletItem>
            <span>熟悉后再开亲友房：</span>
            当你需要自定义房间规则、邀请朋友时，再使用亲友房入口。
          </BulletItem>
          <BulletItem>
            <span>最后参与锦标赛：</span>
            了解持仓门槛、报名费和升盲节奏后，再报名大奖池赛事会更稳妥。
          </BulletItem>
        </BulletList>
      </Section>

      <Section>
        <SectionTitle>术语与常见问题</SectionTitle>
        <SectionLead>以下问题最常出现在第一次使用大厅或准备报名赛事时。</SectionLead>
        <FaqList>
          {FAQ_ITEMS.map((item) => (
            <FaqCard key={item.question}>
              <FaqQuestion>{item.question}</FaqQuestion>
              <FaqAnswer>{item.answer}</FaqAnswer>
            </FaqCard>
          ))}
        </FaqList>
      </Section>

      <FooterNote>
        规则与经济参数以大厅实时展示和后续公告为准，本说明主要帮助你快速理解玩法结构。
      </FooterNote>
    </Wrap>
  );
};

export default LobbyGuideModal;
