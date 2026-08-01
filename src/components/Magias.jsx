import { useEffect, useState } from 'react';
import { SPELLS, SPELL_SLOTS, DEFAULT_HEAL_THRESHOLD_PCT, canCastSpell } from '../data/gameData';
import { computeFinalStats } from '../data/gameData';
import ItemIcon from './ItemIcon';

const COLOR_STYLES = {
  Blue: 'text-blue-300 border-blue-400/30',
  Red: 'text-red-300 border-red-400/30',
  Green: 'text-green-300 border-green-400/30',
  Yellow: 'text-yellow-300 border-yellow-400/30',
  Evil: 'text-purple-300 border-purple-400/30',
};

function useNow(intervalMs) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function Magias({
  character,
  spellCooldowns,
  equipSpell,
  unequipSpell,
  setAutoCastSpells,
  setSpellHealThreshold,
}) {
  const now = useNow(250);
  const stats = computeFinalStats(character);
  const learned = character.learnedSpells ?? [];
  const equipped = character.equippedSpells ?? Array(SPELL_SLOTS).fill(null);

  const knownBooks = new Map((character.inventory ?? []).map((i) => [i.name, i.quantity]));

  return (
    <div className="flex-1 space-y-4">
      <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
        <h3 className="text-gold font-semibold tracking-wide mb-1">◆ MAGIAS</h3>
        <p className="text-[11px] text-neutral-500 mb-3">
          Ler um livro de magia (achado como drop) ensina o feitiço pra sempre — o livro é
          consumido. Depois de aprendida, equipe a magia em um dos {SPELL_SLOTS} slots pra ela
          entrar em ação sozinha durante a caçada, respeitando mana/HP, requisito de Magic/Ability
          e o próprio cooldown de cada uma. Magias puramente utilitárias (Dash, Haste, Mana
          Shield, etc.) ainda não têm efeito simulado nesse jogo — só entram aqui as que causam
          dano ou curam.
        </p>
        <label className="flex items-center gap-2 text-sm text-neutral-200 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={!!character.autoCastSpells}
            onChange={(e) => setAutoCastSpells(e.target.checked)}
            className="accent-gold w-4 h-4 cursor-pointer"
          />
          Uso automático de magias
        </label>
      </div>

      <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
        <h4 className="text-gold text-sm font-semibold mb-2">◆ SLOTS EQUIPADOS</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {equipped.map((spellId, idx) => {
            const spell = SPELLS.find((s) => s.id === spellId);
            const readyAt = spellCooldowns?.[spellId] ?? 0;
            const cooling = readyAt > now;
            return (
              <div key={idx} className="bg-wood border border-wood-lighter rounded-lg p-3 min-h-[76px]">
                {spell ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-neutral-100 truncate">{spell.id}</p>
                      <p className="text-[10px] text-neutral-500">
                        {cooling ? `recarregando ${((readyAt - now) / 1000).toFixed(1)}s` : 'pronta'}
                      </p>
                    </div>
                    <button
                      onClick={() => unequipSpell(idx)}
                      className="text-[10px] font-medium bg-wood-lighter px-2 py-1 rounded shrink-0 cursor-pointer hover:text-blood"
                    >
                      TIRAR
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-neutral-600">Slot {idx + 1} vazio</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-wood-light border border-wood-lighter rounded-lg p-4">
        <h4 className="text-gold text-sm font-semibold mb-3">◆ GRIMÓRIO — {learned.length} aprendidas</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {SPELLS.map((spell) => {
            const isLearned = learned.includes(spell.id);
            const bookQty = knownBooks.get(spell.book) ?? 0;
            const meetsReq = canCastSpell(spell, stats);
            const slotIndex = equipped.indexOf(spell.id);
            const isEquipped = slotIndex >= 0;
            const emptySlot = equipped.indexOf(null);

            return (
              <div
                key={spell.id}
                className={`bg-wood border rounded-lg p-3 flex flex-col gap-2 ${COLOR_STYLES[spell.color] ?? 'border-wood-lighter text-neutral-200'}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ItemIcon name={spell.book} className="w-6 h-6 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{spell.id}</p>
                    <p className="text-[10px] text-neutral-500">
                      {spell.color} · {spell.kind === 'heal' ? 'Cura' : 'Dano'} · custo {spell.manaCost}
                      {spell.hpCast ? ' HP' : ' mana'} · cd {(spell.cooldownMs / 1000).toFixed(1)}s
                    </p>
                    <p className="text-[10px] text-neutral-500">
                      Requer Magic {spell.magicReq}{spell.abilityReq > 0 ? ` / Ability ${spell.abilityReq}` : ''}
                      {!meetsReq && <span className="text-blood"> (não atende ainda)</span>}
                    </p>
                  </div>
                </div>

                {isLearned && spell.kind === 'heal' && (
                  <label className="flex items-center gap-1.5 text-[11px] text-neutral-300">
                    Ativar com vida ≤
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={character.spellHealThresholds?.[spell.id] ?? DEFAULT_HEAL_THRESHOLD_PCT}
                      onChange={(e) =>
                        setSpellHealThreshold(spell.id, Math.min(99, Math.max(1, Number(e.target.value) || 0)))
                      }
                      className="w-14 bg-wood border border-wood-lighter rounded px-1.5 py-0.5 text-neutral-100 focus:outline-none focus:border-gold"
                    />
                    %
                  </label>
                )}

                {!isLearned ? (
                  <p className="text-[11px] text-neutral-500">
                    {bookQty > 0
                      ? `Você tem ${spell.book} — aprenda pela Mochila.`
                      : `Precisa achar ${spell.book} pra aprender.`}
                  </p>
                ) : isEquipped ? (
                  <button
                    onClick={() => unequipSpell(slotIndex)}
                    className="text-[11px] font-medium bg-gold text-wood px-2.5 py-1.5 rounded cursor-pointer hover:bg-yellow-500"
                  >
                    EQUIPADA (slot {slotIndex + 1}) — tirar
                  </button>
                ) : (
                  <button
                    onClick={() => emptySlot >= 0 && equipSpell(spell.id, emptySlot)}
                    disabled={emptySlot < 0}
                    className="text-[11px] font-medium bg-wood-lighter px-2.5 py-1.5 rounded
                               disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:text-gold"
                  >
                    {emptySlot >= 0 ? 'EQUIPAR' : 'Sem slot livre'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
