import { QUESTS_BY_ZONE, isQuestComplete, isQuestClaimed } from '../data/gameData';

export default function Quests({ character, zones, claimQuest }) {
  return (
    <div className="flex-1">
      <div className="bg-wood-light border border-wood-lighter rounded-lg p-4 mb-4">
        <h3 className="text-gold font-semibold tracking-wide mb-1">◆ QUESTS</h3>
        <p className="text-[11px] text-neutral-500">
          Mate criaturas numa zona pra completar as quests dela e ganhar gold e XP extra.
        </p>
      </div>

      {zones.map((zone) => {
        const quests = QUESTS_BY_ZONE[zone.id] ?? [];
        const kills = character.zoneKills?.[zone.id] ?? 0;
        return (
          <div key={zone.id} className="mb-4">
            <h4 className="text-sm font-semibold text-neutral-300 mb-2">
              {zone.name} <span className="text-neutral-600 font-normal">— {kills} abates</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {quests.map((quest) => {
                const complete = isQuestComplete(character, quest);
                const claimed = isQuestClaimed(character, quest);
                const progress = Math.min(100, (kills / quest.requiredKills) * 100);
                return (
                  <div
                    key={quest.id}
                    className={`bg-wood border rounded-lg p-3 flex flex-col gap-2
                      ${claimed ? 'border-wood-lighter opacity-50' : complete ? 'border-gold' : 'border-wood-lighter'}`}
                  >
                    <p className="text-xs font-medium text-neutral-200">{quest.label}</p>
                    <p className="text-[11px] text-neutral-500">{quest.description}</p>
                    <div className="h-1.5 bg-wood-light rounded overflow-hidden">
                      <div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-[10px] text-neutral-500">
                      {Math.min(kills, quest.requiredKills)}/{quest.requiredKills}
                    </p>
                    <p className="text-[11px] text-gold">+{quest.rewardGold}g · +{quest.rewardXp}xp</p>
                    <button
                      onClick={() => claimQuest(quest.id)}
                      disabled={!complete || claimed}
                      className="text-xs font-medium bg-gold text-wood px-2 py-1 rounded
                                 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-yellow-500"
                    >
                      {claimed ? 'RESGATADA' : 'RESGATAR'}
                    </button>
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
