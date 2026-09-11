import { site, type Team } from "../../config/site";

export const TEAMS: readonly Team[] = site.game.teams;
/** The two non-friendly teams in site.game.teams order. */
export function enemyTeams(team: Team): [Team, Team] {
  const rest = TEAMS.filter((x) => x !== team);
  return [rest[0], rest[1]] as [Team, Team];
}
/** Which enemy token colours a faction: the first non-friendly team is enemy-a, the second enemy-b. */
export function enemyTone(team: Team, enemy: Team): "enemy-a" | "enemy-b" {
  return enemyTeams(team)[0] === enemy ? "enemy-a" : "enemy-b";
}
