/**
 * Front-end mirror of server selectModel() logic.
 * Shared between ModelStatusCard and VideoPage.
 */

export const CAMERA_KEYS = ['拉近', '拉远', '左摇', '右摇', '仰摄', '俯摄'] as const;

export function selectModelFrontend(duration: number, cameraMovement: string): string {
  if (cameraMovement && CAMERA_KEYS.includes(cameraMovement as typeof CAMERA_KEYS[number])) {
    return 'Hailuo 2.3';
  }
  if (duration >= 60) return 'Wan 2.6';
  if (duration >= 30) return 'Kling 3.0';
  return 'Happy Horse 1.0';
}
