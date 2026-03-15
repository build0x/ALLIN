import React, { useContext, useMemo } from 'react';
import globalContext from '@/context/global/globalContext';
import tableContext from '@/context/table/tableContext';
import { getCardResource } from '@/utils/CardRes';
import { formatMoney } from '@/utils/Money';

const BoardCards = () => {
  const { cardStyle } = useContext(globalContext);
  const { board } = useContext(tableContext);

  const view = useMemo(() => {
    const current = board.data;
    const pots = current?.getPotBreakdown?.() || [];
    return current ? (
      <div className="container">
        {current.isShowMiddleCards() ? (
          <div className="row justify-center" style={{ justifyContent: 'center' }}>
            {current.middleCards
              ? current.middleCards.map((card, index) => {
                  let path = null;
                  if (card) {
                    path = getCardResource(card, cardStyle);
                  }
                  return (
                    <div
                      className={`middleCard ${
                        current.middleCardsPuffIn[index] && !current.middleCardsSlideUp[index]
                          ? 'magicFast puffIn'
                          : ''
                      } ${current.middleCardsSlideUp[index] ? 'magictime card-glow' : ''}`}
                      key={'MC' + index}
                      style={{
                        backgroundImage: card ? `url(${path})` : 'url()',
                      }}
                    />
                  );
                })
              : ''}
          </div>
        ) : (
          ''
        )}
        <div id="totalPot" className="totalPotText">
          {current.getTotalPot() > 0 ? <div className="moneyView"></div> : ''}
          <div>{current.getTotalPot() > 0 ? formatMoney(current.getTotalPot()) : ''}</div>
        </div>
        {pots.length ? (
          <div
            style={{
              marginTop: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {pots.map((pot, index) => (
              <div
                key={`${pot.label}-${index}`}
                style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: 'rgba(0, 0, 0, 0.28)',
                  border: '1px solid rgba(212, 175, 55, 0.18)',
                  color: '#f1f1f1',
                  fontSize: '13px',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                }}
              >
                {pot.label}
                {pot.type === 'refund' ? ' 返还 ' : ' '}
                {formatMoney(pot.amount)}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    ) : (
      ''
    );
  }, [board, cardStyle]);

  return view;
};

export default BoardCards;
