import { DEFAULT_DIVIDERS, DEFAULT_LID, DEFAULT_PARAMS, type PieceMode, type TrayParams } from './types'

export const PIECE_MODE_LABELS: Record<PieceMode, { en: string, 'pt-BR': string }> = {
  tray: { en: 'Organizer tray', 'pt-BR': 'Bandeja organizadora' },
  coaster: { en: 'Coaster / base', 'pt-BR': 'Descanso / base' },
  cookieCutter: { en: 'Cookie cutter', 'pt-BR': 'Cortador de biscoito' },
  stamp: { en: 'Relief stamp', 'pt-BR': 'Carimbo em relevo' },
  closedBox: { en: 'Box + lid', 'pt-BR': 'Caixa + tampa' }
}

/** Parameter presets applied when switching piece mode (dimensions are kept). */
export function pieceModePreset(mode: PieceMode): Partial<TrayParams> {
  switch (mode) {
    case 'coaster':
      return {
        pieceMode: mode,
        wallHeight: 0,
        bottomThickness: 4,
        wallThickness: 2,
        taperAngle: 0,
        lid: { ...DEFAULT_LID, enabled: false },
        dividers: { ...DEFAULT_DIVIDERS, enabled: false }
      }
    case 'cookieCutter':
      return {
        pieceMode: mode,
        wallHeight: 12,
        wallThickness: 0.8,
        bottomThickness: 0.4,
        cookieCutterBase: false,
        taperAngle: 0,
        lid: { ...DEFAULT_LID, enabled: false },
        dividers: { ...DEFAULT_DIVIDERS, enabled: false }
      }
    case 'stamp':
      return {
        pieceMode: mode,
        wallHeight: 0,
        bottomThickness: 4,
        stampDepth: 3,
        taperAngle: 0,
        lid: { ...DEFAULT_LID, enabled: false },
        dividers: { ...DEFAULT_DIVIDERS, enabled: false }
      }
    case 'closedBox':
      return {
        pieceMode: mode,
        wallHeight: 30,
        wallThickness: 2,
        bottomThickness: 2,
        lid: { enabled: true, thickness: 2, clearance: 0.35, lipDepth: 6, lipThickness: 0 },
        dividers: { ...DEFAULT_DIVIDERS, enabled: false }
      }
    default:
      return {
        pieceMode: 'tray',
        wallHeight: DEFAULT_PARAMS.wallHeight,
        wallThickness: DEFAULT_PARAMS.wallThickness,
        bottomThickness: DEFAULT_PARAMS.bottomThickness,
        taperAngle: DEFAULT_PARAMS.taperAngle
      }
  }
}

export function applyPieceModeToParams(params: TrayParams, mode: PieceMode) {
  const preset = pieceModePreset(mode)
  params.pieceMode = mode
  if (preset.wallHeight !== undefined) params.wallHeight = preset.wallHeight
  if (preset.wallThickness !== undefined) params.wallThickness = preset.wallThickness
  if (preset.bottomThickness !== undefined) params.bottomThickness = preset.bottomThickness
  if (preset.taperAngle !== undefined) params.taperAngle = preset.taperAngle
  if (preset.stampDepth !== undefined) params.stampDepth = preset.stampDepth
  if (preset.cookieCutterBase !== undefined) params.cookieCutterBase = preset.cookieCutterBase
  if (preset.lid) Object.assign(params.lid, preset.lid)
  if (preset.dividers) Object.assign(params.dividers, preset.dividers)
}
