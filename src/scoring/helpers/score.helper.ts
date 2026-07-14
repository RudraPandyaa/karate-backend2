import { ScoreType } from '@prisma/client';

export class ScoreHelper {
  static getPoints(type: ScoreType): number {
    switch (type) {
      case ScoreType.YUKO:
        return 1;
      case ScoreType.WAZA_ARI:
        return 2;
      case ScoreType.IPPON:
        return 3;
      default:
        return 0;
    }
  }

  /**
   * Karate Kumite Mercy Rule (common in many federations):
   * If one athlete leads by 8 or more points, the match ends immediately.
   * Adjust the threshold if your specific rules differ (e.g., 10 points, or time-dependent).
   */
  static checkMercyRule(redScore: number, blueScore: number): boolean {
    const lead = Math.abs(redScore - blueScore);
    return lead >= 8; // Standard mercy / point gap rule
  }
}