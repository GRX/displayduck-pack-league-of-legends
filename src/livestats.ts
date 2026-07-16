import {
  httpFetch,
  signal,
  type Signal,
  type WidgetContext,
  type WidgetPayload,
} from '@displayduck/base';

type LoLTeam = 'ORDER' | 'CHAOS';
type SummonerSpellSlot = 'summonerSpellOne' | 'summonerSpellTwo';

type LoLPlayer = {
  [key: string]: unknown;
  name: string;
  gameName: string;
  champion: string;
  team: LoLTeam | null;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  creepScore: number;
  isDead: boolean;
};

type LoLTeamGroup = {
  teamNumber: 0 | 1;
  players: LoLPlayer[];
};

type LoLTeamStats = {
  kills: number;
  deaths: number;
  assists: number;
  creepScore: number;
  towers: number;
  inhibitors: number;
};

type LoLMatch = {
  gameMode: string;
  teamFormat: string;
  mapName: string;
  gameTime: number;
  activePlayer: LoLPlayer | null;
  activePlayerName: string;
  activeTeam: LoLTeam | null;
  players: LoLPlayer[];
  teams: [LoLTeamGroup, LoLTeamGroup];
  teamStats: [LoLTeamStats, LoLTeamStats];
};

export class DisplayDuckWidget {
  public config: Signal<WidgetPayload>;
  public match = signal<LoLMatch | null>(null);
  public status = signal('WAITING FOR GAME');
  public readonly waitingCircles = Array.from({ length: 100 }, (_, index) => index);

  // Set to false to use the live League Client Data API instead.
  private testMode = false;
  private readonly gameModeFormats = new Map<string, string>([
    ['SWIFTPLAY', '5v5'],
    ['CLASSIC', '5v5'],
    ['ARAM', '5v5'],
    ['URF', '5v5'],
    ['ONEFORALL', '5v5'],
    ['NEXUSBLITZ', '5v5'],
    ['ARENA', '2v2'],
    ['TUTORIAL', '1v1'],
    ['PRACTICETOOL', '1v1'],
    ['OTHER', '5v5'],
  ]);
  private readonly primalSmiteImageNames = new Map<string, string>([
    ['gustwalker', 'Gustwalker Primal Smite'],
    ['mosstomper', 'Mosstomper Primal Smite'],
    ['scorchclaw', 'Scorchclaw Primal Smite'],
  ]);
  private readonly primalSmiteItemNames = new Map<number, string>([
    [1101, 'Scorchclaw Primal Smite'],
    [1102, 'Gustwalker Primal Smite'],
    [1103, 'Mosstomper Primal Smite'],
  ]);
  private readonly primalSmiteByPlayer = new Map<string, string>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pollInFlight = false;

  public constructor(private readonly ctx: WidgetContext) {
    this.config = signal(ctx.payload ?? {});
  }

  public onInit(): void {
    this.startPolling();
  }

  public onUpdate(payload: WidgetPayload): void {
    this.config.set(payload ?? {});
    this.startPolling();
  }

  public onDestroy(): void {
    this.stopPolling();
  }

  public playersForTeam(team: LoLTeam): LoLPlayer[] {
    return this.match()?.players.filter((player) => player.team === team) ?? [];
  }

  public comparisonShare(stat: keyof LoLTeamStats): number {
    const teamStats = this.match()?.teamStats;
    if (!teamStats) {
      return 50;
    }

    const leftValue = teamStats[0][stat];
    const rightValue = teamStats[1][stat];
    const total = leftValue + rightValue;

    return total > 0 ? (leftValue / total) * 100 : 50;
  }

  public summonerSpellImageUrl(player: LoLPlayer, slot: SummonerSpellSlot): string {
    const spells = this.isRecord(player.summonerSpells) ? player.summonerSpells : null;
    const spell = spells && this.isRecord(spells[slot]) ? spells[slot] : null;
    const displayName = this.getString(spell?.displayName);

    if (!displayName) {
      return '';
    }

    const imageName = displayName === 'Primal Smite'
      ? this.getPrimalSmiteImageName(player)
      : displayName;
    const safeImageName = encodeURIComponent(imageName.replace(/\s+/g, '_'));

    return `https://wiki.leagueoflegends.com/en-us/images/thumb/${safeImageName}_HD.png/120px-${safeImageName}_HD.png`;
  }

  public formatGameTime(seconds: number | null | undefined): string {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
      return '--:--';
    }

    const totalSeconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  private startPolling(): void {
    this.stopPolling();
    void this.poll();
    this.pollTimer = setInterval(() => {
      void this.poll();
    }, this.getPollInterval());
  }

  private stopPolling(): void {
    if (!this.pollTimer) {
      return;
    }

    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private async poll(): Promise<void> {
    if (this.pollInFlight) {
      return;
    }

    this.pollInFlight = true;
    try {
      const apiUrl = this.getApiUrl();
      const parsed = this.testMode
        ? fakeMatch.data
        : JSON.parse(await httpFetch(apiUrl)) as unknown;
      console.log('[DisplayDuck LoL] Incoming data', {
        timestamp: new Date().toISOString(),
        url: apiUrl,
        testMode: this.testMode,
        data: parsed,
      });
      const nextMatch = this.normalizeMatch(parsed);

      if (!nextMatch) {
        this.match.set(null);
        this.status.set('WAITING FOR GAME');
        return;
      }

      this.match.set(nextMatch);
      console.log(nextMatch);
      this.status.set('LIVE');
    } catch (error) {
      console.error('[DisplayDuck LoL] Poll failed', {
        timestamp: new Date().toISOString(),
        url: this.getApiUrl(),
        error,
      });
      this.match.set(null);
      this.status.set('WAITING FOR GAME');
    } finally {
      this.pollInFlight = false;
      this.ctx.setLoading(false);
    }
  }

  private normalizeMatch(value: unknown): LoLMatch | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const gameData = this.isRecord(value.gameData) ? value.gameData : null;
    if (!gameData) {
      return null;
    }

    const players = Array.isArray(value.allPlayers)
      ? value.allPlayers
        .filter((player) => this.isRecord(player))
        .map((player) => this.normalizePlayer(player))
      : [];
    const activePlayerData = this.isRecord(value.activePlayer) ? value.activePlayer : null;
    const activePlayerName = activePlayerData
      ? this.getPlayerName(activePlayerData)
      : '';
    const activePlayer = players.find((player) => player.name === activePlayerName) ?? null;
    const currentTeam: LoLTeam = activePlayer?.team ?? 'ORDER';
    const opposingTeam: LoLTeam = currentTeam === 'ORDER' ? 'CHAOS' : 'ORDER';
    const teams: [LoLTeamGroup, LoLTeamGroup] = [
      {
        teamNumber: currentTeam === 'ORDER' ? 0 : 1,
        players: players.filter((player) => player.team === currentTeam),
      },
      {
        teamNumber: opposingTeam === 'ORDER' ? 0 : 1,
        players: players.filter((player) => player.team === opposingTeam),
      },
    ];

    const gameMode = this.getString(gameData.gameMode) || 'UNKNOWN MODE';
    const statsByTeam = this.buildTeamStats(players, value.events);

    return {
      gameMode,
      teamFormat: this.gameModeFormats.get(gameMode) ?? this.gameModeFormats.get('OTHER')!,
      mapName: this.getString(gameData.mapName) || 'UNKNOWN MAP',
      gameTime: this.getNumber(gameData.gameTime) ?? 0,
      activePlayer,
      activePlayerName: activePlayer?.name || activePlayerName || 'ACTIVE PLAYER',
      activeTeam: activePlayer?.team ?? null,
      players,
      teams,
      teamStats: [statsByTeam[currentTeam], statsByTeam[opposingTeam]],
    };
  }

  private buildTeamStats(
    players: LoLPlayer[],
    eventsValue: unknown,
  ): Record<LoLTeam, LoLTeamStats> {
    const stats: Record<LoLTeam, LoLTeamStats> = {
      ORDER: { kills: 0, deaths: 0, assists: 0, creepScore: 0, towers: 0, inhibitors: 0 },
      CHAOS: { kills: 0, deaths: 0, assists: 0, creepScore: 0, towers: 0, inhibitors: 0 },
    };

    for (const player of players) {
      if (!player.team) {
        continue;
      }

      stats[player.team].kills += player.kills;
      stats[player.team].deaths += player.deaths;
      stats[player.team].assists += player.assists;
      stats[player.team].creepScore += player.creepScore;
    }

    const events = this.isRecord(eventsValue) && Array.isArray(eventsValue.Events)
      ? eventsValue.Events
      : [];

    for (const eventValue of events) {
      if (!this.isRecord(eventValue)) {
        continue;
      }

      const eventName = this.getString(eventValue.EventName).toLowerCase();
      const isTowerEvent = eventName === 'turretkilled';
      const isInhibitorEvent = eventName.includes('inhibitor');

      if (!isTowerEvent && !isInhibitorEvent) {
        continue;
      }

      const structureName = isTowerEvent
        ? this.getString(eventValue.TurretKilled)
        : this.getString(eventValue.InhibitorKilled) || this.getString(eventValue.InhibKilled);
      const destroyedTeam = this.getTeamFromStructureName(structureName);
      const killerTeam = this.getTeamForPlayerName(players, eventValue.KillerName);
      const scoringTeam = destroyedTeam
        ? destroyedTeam === 'ORDER' ? 'CHAOS' : 'ORDER'
        : killerTeam;

      if (!scoringTeam) {
        continue;
      }

      if (isTowerEvent) {
        stats[scoringTeam].towers += 1;
      } else {
        stats[scoringTeam].inhibitors += 1;
      }
    }

    return stats;
  }

  private getTeamForPlayerName(players: LoLPlayer[], value: unknown): LoLTeam | null {
    const name = this.getString(value).toLowerCase();
    if (!name) {
      return null;
    }

    const player = players.find((candidate) => [
      candidate.name,
      candidate.gameName,
      candidate.riotId,
      candidate.riotIdGameName,
      candidate.summonerName,
    ].some((candidateName) => this.getString(candidateName).toLowerCase() === name));

    return player?.team ?? null;
  }

  private getTeamFromStructureName(value: string): LoLTeam | null {
    const name = value.toLowerCase();
    if (name.includes('order') || name.includes('t100')) {
      return 'ORDER';
    }

    if (name.includes('chaos') || name.includes('t200')) {
      return 'CHAOS';
    }

    return null;
  }

  private normalizePlayer(player: Record<string, unknown>): LoLPlayer {
    const scores = this.isRecord(player.scores) ? player.scores : null;
    const team = this.getString(player.team);
    this.rememberPrimalSmitePet(player);

    return {
      ...player,
      name: this.getPlayerName(player) || 'UNKNOWN PLAYER',
      gameName: this.getString(player.riotIdGameName) || this.getPlayerName(player),
      champion: this.getString(player.championName) || 'Unknown champion',
      team: team === 'ORDER' || team === 'CHAOS' ? team : null,
      level: this.getNumber(player.level) ?? 0,
      kills: scores ? this.getNumber(scores.kills) ?? 0 : 0,
      deaths: scores ? this.getNumber(scores.deaths) ?? 0 : 0,
      assists: scores ? this.getNumber(scores.assists) ?? 0 : 0,
      creepScore: scores ? this.getNumber(scores.creepScore) ?? 0 : 0,
      isDead: player.isDead === true,
    };
  }

  private getPlayerName(player: Record<string, unknown>): string {
    const riotId = this.getString(player.riotId);
    const gameName = this.getString(player.riotIdGameName);
    const tagLine = this.getString(player.riotIdTagLine);
    const summonerName = this.getString(player.summonerName);

    return riotId || (gameName && tagLine ? `${gameName}#${tagLine}` : gameName) || summonerName;
  }

  private getPrimalSmiteImageName(player: LoLPlayer): string {
    const detectedImageName = this.detectPrimalSmiteImageName(player);
    if (detectedImageName) {
      return detectedImageName;
    }

    return this.primalSmiteByPlayer.get(this.getPlayerKey(player)) ?? 'Smite';
  }

  private rememberPrimalSmitePet(player: Record<string, unknown>): void {
    const imageName = this.detectPrimalSmiteImageName(player);
    if (imageName) {
      this.primalSmiteByPlayer.set(this.getPlayerKey(player), imageName);
    }
  }

  private detectPrimalSmiteImageName(player: Record<string, unknown>): string | null {
    const items = Array.isArray(player.items) ? player.items : [];

    for (const item of items) {
      if (!this.isRecord(item)) {
        continue;
      }

      const itemId = this.getNumber(item.itemID);
      const imageNameById = itemId ? this.primalSmiteItemNames.get(itemId) : undefined;
      if (imageNameById) {
        return imageNameById;
      }

      const itemName = this.getString(item.displayName).toLowerCase();
      for (const [petName, imageName] of this.primalSmiteImageNames) {
        if (itemName.includes(petName)) {
          return imageName;
        }
      }
    }

    return null;
  }

  private getPlayerKey(player: Record<string, unknown>): string {
    return this.getString(player.riotId)
      || this.getString(player.summonerName)
      || this.getPlayerName(player);
  }

  private getApiUrl(): string {
    return `https://127.0.0.1:${this.getApiPort()}/liveclientdata/allgamedata`;
  }

  private getApiPort(): number {
    const configuredPort = Number(this.getConfigValue('apiPort'));
    return Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort <= 65535
      ? configuredPort
      : 2999;
  }

  private getPollInterval(): number {
    const configuredInterval = Number(this.getConfigValue('pollInterval'));
    return Number.isFinite(configuredInterval)
      ? Math.max(250, Math.min(5000, Math.round(configuredInterval)))
      : 1000;
  }

  private getConfigValue(key: string): unknown {
    const payloadConfig = this.config().config;
    if (!this.isRecord(payloadConfig)) {
      return undefined;
    }

    return payloadConfig[key];
  }

  private getString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private getNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}
