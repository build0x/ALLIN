import React, { useContext, useEffect, useMemo, useState } from 'react';
import HoldemSeatSlot from './HoldemSeatSlot';
import tableContext from '@/context/table/tableContext';
import socketContext from '@/context/websocket/socketContext';

const mobileOpponentSlotsByCount = {
  1: ['top'],
  2: ['lower-left', 'top'],
  3: ['lower-left', 'top', 'lower-right'],
  4: ['lower-left', 'upper-left', 'top', 'upper-right'],
  5: ['lower-left', 'upper-left', 'top', 'upper-right', 'lower-right'],
};

const mobileSpectatorSlotsByCount = {
  1: ['top'],
  2: ['upper-left', 'upper-right'],
  3: ['upper-left', 'top', 'upper-right'],
  4: ['lower-left', 'upper-left', 'upper-right', 'lower-right'],
  5: ['lower-left', 'upper-left', 'top', 'upper-right', 'lower-right'],
  6: ['lower-left', 'upper-left', 'top', 'upper-right', 'lower-right', 'hero'],
};

const mobileBetClassBySlot = {
  top: 'bet-top',
  'upper-left': 'bet-left-arc',
  'upper-right': 'bet-right-arc',
  'lower-left': 'bet-left-lower',
  'lower-right': 'bet-right-lower',
  hero: 'bet-bottom',
};

const HoldemTable = ({ children }) => {
  const { seats } = useContext(tableContext);
  const { playerId } = useContext(socketContext);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  const current = seats.data;

  const heroSeatIndex = useMemo(
    () =>
      current.findIndex((seat) => seat?.seatFrame && Number(seat.playerId) === Number(playerId)),
    [current, playerId]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const updateViewport = () => setIsMobile(window.innerWidth <= 768);
    updateViewport();
    window.addEventListener('resize', updateViewport);

    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  const renderSeat = (seatIndex, options = {}) => {
    const seat = current[seatIndex];
    if (!seat || !seat.seatFrame) {
      return null;
    }

    return (
      <HoldemSeatSlot
        pos={`s${seatIndex + 1}`}
        className={options.className}
        seat={seat}
        playerId={playerId}
        betLeft={options.betLeft}
        betRight={options.betRight}
        betClassName={options.betClassName}
      />
    );
  };

  if (isMobile) {
    const visibleSeats = current
      .map((seat, seatIndex) => ({ seatIndex, seat }))
      .filter(({ seat }) => seat?.seatFrame);

    const relativeSeats =
      heroSeatIndex >= 0
        ? Array.from({ length: current.length - 1 }, (_, index) => {
            const seatIndex = (heroSeatIndex + index + 1) % current.length;
            return {
              seatIndex,
              seat: current[seatIndex],
            };
          }).filter(({ seat }) => seat?.seatFrame)
        : visibleSeats;

    const opponentSlots =
      heroSeatIndex >= 0
        ? mobileOpponentSlotsByCount[relativeSeats.length] || []
        : mobileSpectatorSlotsByCount[relativeSeats.length] || [];

    return (
      <div id="pokerTable" className="poker-table holdem-mobile-table">
        <div className="holdem-mobile-surface" />
        <div className="holdem-mobile-board">{children}</div>

        {relativeSeats.map(({ seatIndex }, index) => {
          const slot = opponentSlots[index];
          if (!slot) {
            return null;
          }

          return (
            <div
              key={`${slot}-${seatIndex}`}
              className={`holdem-mobile-seat holdem-mobile-seat-${slot}`}
            >
              {renderSeat(seatIndex, {
                className: `mobile-seat-slot mobile-seat-slot-${slot}`,
                betClassName: mobileBetClassBySlot[slot],
              })}
            </div>
          );
        })}

        {heroSeatIndex >= 0 ? (
          <div className="holdem-mobile-seat holdem-mobile-seat-hero">
            {renderSeat(heroSeatIndex, {
              className: 'mobile-seat-slot mobile-seat-slot-hero',
              betClassName: mobileBetClassBySlot.hero,
            })}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div id="pokerTable" className="poker-table">
      {/* <!-- Top layout --> */}
      <div className="row tableRow">
        <div className="col">
          {/* <!-- Seat layout --> */}
          {renderSeat(2, { className: 'float-right', betRight: true })}
          {/* <!-- /Seat --> */}
        </div>
        <div className="col-2">{/* <!-- POT INFO --> */}</div>
        <div className="col">
          {/* <!-- Seat layout --> */}
          {renderSeat(3, { className: 'float-left', betLeft: true })}
          {/* <!-- /Seat --> */}
        </div>
      </div>

      {/* <!-- Middle layout --> */}
      <div className="row tableRow">
        <div className="col">
          {/* <!-- Seat layout --> */}
          {renderSeat(1, { betRight: true })}
          {/* <!-- /Seat --> */}
        </div>
        <div className="col-5">
          {/* <!-- MIDDLE CARDS --> */}
          {children}
          {/* <!-- /MIDDLE CARDS --> */}
        </div>
        <div className="col">
          {/* <!-- Seat layout --> */}
          {renderSeat(4, { betLeft: true })}
        </div>
      </div>

      {/* <!-- Bottom layout --> */}
      <div className="row tableRow">
        <div className="col">{renderSeat(0, { className: 'float-right', betRight: true })}</div>
        <div className="col-2">{/* <!-- Empty space --> */}</div>
        <div className="col">
          {/* <!-- Seat layout --> */}
          {renderSeat(5, { className: 'float-left', betLeft: true })}
        </div>
      </div>
    </div>
  );
};

export default HoldemTable;
