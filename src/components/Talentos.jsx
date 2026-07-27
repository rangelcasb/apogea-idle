import { TALENTS, TALENT_BRANCHES, TALENTS_BY_ID, canInvestTalent, meetsTalentRequirement } from '../data/talents';

function TalentNode({ talent, points, canInvest, isActive, onInvest }) {
  const isMaxed = points >= talent.maxPoints;
  return (
    <div
      className={`bg-wood border rounded-lg p-3 flex flex-col gap-1
        ${points > 0 ? (isActive ? 'border-gold' : 'border-blood') : 'border-wood-lighter'}
        ${!canInvest && !isMaxed ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-100">{talent.name}</p>
        <span className="text-xs text-gold">{points}/{talent.maxPoints}</span>
      </div>
      <p className="text-[11px] text-neutral-500">{talent.description}</p>
      {talent.requirementLabel && (
        <p className={`text-[10px] ${isActive ? 'text-green-500' : 'text-blood'}`}>
          {talent.requirementLabel}
          {points > 0 && (isActive ? ' — ativo' : ' — inativo agora')}
        </p>
      )}
      {talent.ranks.length > 0 && (
        <p className="text-[10px] text-neutral-600">Ranks: {talent.ranks.join(' → ')}</p>
      )}
      <button
        onClick={() => onInvest(talent.id)}
        disabled={!canInvest || isMaxed}
        className="mt-1 self-start text-xs font-medium bg-gold text-wood px-2.5 py-1 rounded
                   disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-yellow-500"
      >
        +1 ponto
      </button>
    </div>
  );
}

export default function Talentos({ character, talentPointsAvailable, investTalent, resetTalents, talentResetCost }) {
  const branches = Object.keys(TALENT_BRANCHES).filter((b) => b !== 'core');
  const talentPoints = character.talentPoints ?? {};
  const hasInvestedPoints = Object.values(talentPoints).some((p) => p > 0);

  return (
    <div className="flex-1">
      <div className="bg-wood-light border border-wood-lighter rounded-lg p-4 mb-4">
        <h3 className="text-gold font-semibold tracking-wide mb-1">◆ TALENTOS</h3>
        <p className="text-xs text-neutral-400">
          {talentPointsAvailable} ponto(s) disponível(is) — 1 ponto a cada 2 níveis.
        </p>
        <p className="text-[11px] text-neutral-600 mt-1">
          Árvore real do Apogea (nomes, descrições e ramos). Talentos de arma/armadura
          (Adaga, Arco, Espada, Escudo, Orbe, Armaduras) só funcionam se você tiver o
          item certo equipado — troque de arma e eles ligam/desligam na hora. Os que
          dependem de magias que este jogo idle não simula usam um bônus aproximado.
        </p>
        <button
          onClick={resetTalents}
          disabled={!hasInvestedPoints || character.gold < talentResetCost}
          className="mt-3 text-xs font-medium bg-wood border border-wood-lighter rounded px-3 py-1.5
                     disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:border-blood hover:text-blood"
        >
          RESETAR TALENTOS ({talentResetCost.toLocaleString('pt-BR')}G)
        </button>
        <p className="text-[10px] text-neutral-600 mt-1">
          Custo dobra a cada reset (começa em 200g). Devolve todos os pontos investidos.
        </p>
      </div>

      {branches.map((branch) => {
        const nodes = TALENTS.filter((t) => t.branch === branch);
        return (
          <div key={branch} className="mb-4">
            <h4 className="text-sm font-semibold text-neutral-300 mb-2">{TALENT_BRANCHES[branch]}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {nodes.map((talent) => {
                const points = talentPoints[talent.id] ?? 0;
                const canInvest = talentPointsAvailable > 0 && canInvestTalent(talentPoints, talent.id);
                const parentName = talent.parent !== null ? TALENTS_BY_ID[talent.parent]?.name : null;
                const isActive = meetsTalentRequirement(character.equipment, talent.branch);
                return (
                  <div key={talent.id} className="flex flex-col gap-1">
                    {parentName && <p className="text-[10px] text-neutral-600">↳ requer {parentName}</p>}
                    <TalentNode talent={talent} points={points} canInvest={canInvest} isActive={isActive} onInvest={investTalent} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
