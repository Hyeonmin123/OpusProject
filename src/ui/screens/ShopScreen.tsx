import { useState } from 'react';
import { RELICS } from '../../data/relics';
import { SHOP_CANDLE_AMOUNT } from '../../engine';
import { useGame } from '../../store/gameStore';
import type { RunState } from '../../types';
import { ICONS } from '../art';
import { CardView } from '../components/CardView';
import { DeckModal } from '../components/DeckModal';
import { Icon } from '../components/Icon';
import styles from './Screens.module.css';

function Price({ price, gold }: { price: number; gold: number }) {
  return (
    <span className={`${styles.price} ${price > gold ? styles.priceTooHigh : ''}`}>◉ {price}</span>
  );
}

export function ShopScreen({ run }: { run: RunState }) {
  const shop = run.shop!;
  const gold = run.player.gold;
  const buyCard = useGame((s) => s.buyShopCard);
  const buyRelic = useGame((s) => s.buyShopRelic);
  const removeCard = useGame((s) => s.shopRemoveCard);
  const buyCandle = useGame((s) => s.buyShopCandle);
  const leave = useGame((s) => s.leaveShop);
  const [removing, setRemoving] = useState(false);

  const canRemove = !shop.removeUsed && gold >= shop.removePrice && run.player.deck.length > 1;
  const p = run.player;
  const canBuyCandle = !shop.candleUsed && gold >= shop.candlePrice && p.candle < p.maxCandle;

  return (
    <div className={`${styles.screen} fade-in`}>
      <div className={`${styles.box} panel`}>
        <div className={styles.head}>
          <div className={styles.icon}>💰</div>
          <div>
            <h2>떠돌이 상인</h2>
            <div className="dim">"살아서 돌아올 생각이라면… 뭐든 사 두는 게 좋을걸."</div>
          </div>
        </div>

        <div className={styles.sectionTitle}>카드</div>
        <div className={styles.shopGrid}>
          {shop.cards.map((slot, i) => (
            <div key={slot.card.uid} className={styles.shopItem}>
              <CardView
                card={slot.card}
                disabled={slot.sold || gold < slot.price}
                onClick={() => buyCard(i)}
              />
              {slot.sold ? (
                <span className={styles.soldOut}>판매 완료</span>
              ) : (
                <Price price={slot.price} gold={gold} />
              )}
            </div>
          ))}
        </div>

        {shop.relics.length > 0 && (
          <>
            <div className={styles.sectionTitle}>유물</div>
            <div className={styles.relicList}>
              {shop.relics.map((slot, i) => {
                const relic = RELICS[slot.relicId];
                return (
                  <button
                    key={slot.relicId}
                    className={`btn ${styles.relicCard}`}
                    disabled={slot.sold || gold < slot.price}
                    onClick={() => buyRelic(i)}
                  >
                    <span className={styles.relicIcon}>{relic.icon}</span>
                    <span className={styles.relicName}>{relic.name}</span>
                    <span className={styles.relicDesc}>{relic.description}</span>
                    {slot.sold ? (
                      <span className={styles.soldOut}>판매 완료</span>
                    ) : (
                      <Price price={slot.price} gold={gold} />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className={styles.sectionTitle}>서비스</div>
        <div className={styles.relicList}>
          <button
            className={`btn ${styles.relicCard}`}
            disabled={!canRemove}
            onClick={() => setRemoving(true)}
          >
            <span className={styles.relicIcon}>🗑️</span>
            <span className={styles.relicName}>카드 제거</span>
            <span className={styles.relicDesc}>덱에서 카드 1장을 영구히 제거합니다.</span>
            {shop.removeUsed ? (
              <span className={styles.soldOut}>이용 완료</span>
            ) : (
              <Price price={shop.removePrice} gold={gold} />
            )}
          </button>
          <button
            className={`btn ${styles.relicCard}`}
            disabled={!canBuyCandle}
            onClick={buyCandle}
          >
            <span className={styles.relicIcon}>
              <Icon src={ICONS.candle} size={32} />
            </span>
            <span className={styles.relicName}>양초</span>
            <span className={styles.relicDesc}>
              촛농을 {SHOP_CANDLE_AMOUNT} 회복합니다. (현재 {p.candle}/{p.maxCandle})
            </span>
            {shop.candleUsed ? (
              <span className={styles.soldOut}>판매 완료</span>
            ) : (
              <Price price={shop.candlePrice} gold={gold} />
            )}
          </button>
        </div>

        <div className={styles.footer}>
          <button className="btn btn-primary btn-large" onClick={leave}>
            떠나기
          </button>
        </div>
      </div>

      {removing && (
        <DeckModal
          title="제거할 카드 선택"
          subtitle={`비용: ${shop.removePrice} 골드`}
          cards={run.player.deck}
          onPick={(card) => {
            removeCard(card.uid);
            setRemoving(false);
          }}
          onClose={() => setRemoving(false)}
        />
      )}
    </div>
  );
}
