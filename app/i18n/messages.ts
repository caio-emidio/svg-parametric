export type Locale = 'en' | 'pt-BR'

export const LOCALES: { id: Locale, label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'pt-BR', label: 'PT' }
]

type Dict = Record<string, string | Dict>

export const messages: Record<Locale, Dict> = {
  en: {
    meta: {
      title: 'SVG → 3D Tray Generator',
      description: 'Convert any SVG silhouette into a hollow, printable 3D tray and export a watertight STL.'
    },
    app: {
      title: 'SVG → Tray',
      titleAccent: '3D',
      tagline: 'Parametric hollow tray generator · all units in mm'
    },
    locale: {
      switch: 'Language'
    },
    section: {
      svgInput: 'SVG Input',
      dimensions: 'Dimensions',
      trayGeometry: 'Tray Geometry',
      compartments: 'Compartments',
      lid: 'Lid',
      cut2d: '2D cut export',
      bambu: 'Bambu 3MF',
      actions: 'Actions'
    },
    field: {
      width: 'Width',
      height: 'Height',
      preserveAspect: 'Preserve aspect ratio',
      scale: 'Scale',
      wallHeight: 'Wall height',
      wallThickness: 'Wall thickness',
      bottomThickness: 'Bottom thickness',
      wallTaper: 'Wall taper',
      cornerRounding: 'Corner rounding',
      internalDividers: 'Internal dividers',
      rows: 'Rows',
      columns: 'Columns',
      dividerThickness: 'Divider thickness',
      generateLid: 'Generate lid',
      lidThickness: 'Lid thickness',
      clearance: 'Clearance',
      lipDepth: 'Lip depth',
      lipThickness: 'Lip thickness',
      kerf: 'Kerf / beam width',
      layerHeightHint: 'Layer height (hint)',
      elephantFootHint: 'Elephant foot (hint)'
    },
    bambu: {
      hint: 'Export is a ZIP: open *_tray.3mf on plate 1, add plate 2 in Bambu, import *_lid.3mf. See LEIA-ME-Bambu.txt inside the ZIP.'
    },
    action: {
      reset: 'Reset',
      regenerate: 'Regenerate',
      exportTrayStl: 'Export tray STL',
      exportLidStl: 'Export lid STL',
      exportCutSvg: 'Export SVG (2D cut)',
      exportBambuZip: 'Export Bambu ZIP (tray + lid)'
    },
    input: {
      dropTitle: 'Drag & drop an SVG or silhouette here',
      dropHint: 'PNG with transparency works best; JPEG uses corner background detection.',
      browse: 'Browse files…',
      tracing: 'Tracing image to SVG…',
      exportSvg: 'Export SVG',
      replace: 'Replace',
      sourceImage: 'Source image',
      tracedSilhouette: 'Traced silhouette',
      imageTracing: 'Image tracing',
      threshold: 'Threshold',
      simplification: 'Simplification',
      largestContourOnly: 'Use largest contour only',
      retrace: 'Retrace',
      shapesToUse: 'Shapes to use ({selected}/{total})',
      contour: 'contour',
      contours: 'contours',
      examples: 'Examples'
    },
    sample: {
      heart: 'Heart',
      star: 'Star',
      'rounded-rect': 'Rounded rectangle',
      ring: 'Ring (hole)'
    },
    viewer: {
      webglError: 'WebGL is not available in this browser, so the 3D preview cannot be shown.',
      top: 'Top',
      front: 'Front',
      side: 'Side',
      iso: 'Iso',
      wireframe: 'Wireframe',
      resetCamera: 'Reset camera',
      generating: 'Generating geometry…',
      emptyTitle: 'Turn any SVG into a printable tray',
      emptyBody: 'Upload a silhouette (heart, star, logo, letter…) or start with an example. The hollow tray is built with true polygon offsets, previewed in 3D and exported as a watertight STL.',
      errorTitle: "Can't generate a valid tray",
      preview: {
        tray: 'Tray',
        lid: 'Lid',
        both: 'Both'
      }
    },
    status: {
      idle: 'Idle',
      generating: 'Generating…',
      ready: 'Model ready',
      error: 'Invalid geometry',
      size: 'Size',
      wall: 'Wall',
      heightAbbr: 'h',
      thicknessAbbr: 't',
      bbox: 'BBox',
      meshOk: 'Mesh watertight ✓',
      meshInvalid: 'INVALID',
      tris: 'tris',
      parts: 'parts',
      export: 'Export'
    },
    export: {
      status: {
        idle: 'idle',
        exporting: 'exporting',
        done: 'done',
        error: 'error'
      },
      noSvg: 'No SVG to export.',
      noModel: 'Export blocked: there is no valid model.',
      noLid: 'Export blocked: there is no valid lid.',
      noTray: 'Export blocked: there is no valid tray.',
      needLidFor3mf: 'Enable “Generate lid” and wait for a valid lid mesh to export the Bambu ZIP.',
      noCutGeometry: 'Export blocked: no cut geometry is available.',
      exportedStl: 'Exported {name} ({kb} KB, {tris} triangles)',
      exportedLidStl: 'Exported {name} ({kb} KB)',
      exportedSvg: 'Exported {name}',
      exportedCut: 'Exported {name} ({layers} layer(s), kerf {kerf} mm)',
      exportedBambu: 'Exported {name}: open *_tray.3mf, add plate 2, import *_lid.3mf. See LEIA-ME-Bambu.txt.{bottomHint}',
      bottomHint: ' Set bottom thickness to {mm} mm ({layers}× {layer} mm layers) if you see a line at the floor height.',
      unsupportedFile: 'Choose an SVG or a silhouette image (PNG, JPEG, WebP).'
    }
  },
  'pt-BR': {
    meta: {
      title: 'SVG → Bandeja 3D',
      description: 'Converta qualquer silhueta SVG em uma bandeja oca para impressão 3D e exporte STL watertight.'
    },
    app: {
      title: 'SVG → Bandeja',
      titleAccent: '3D',
      tagline: 'Gerador paramétrico de bandeja oca · todas as unidades em mm'
    },
    locale: {
      switch: 'Idioma'
    },
    section: {
      svgInput: 'Entrada SVG',
      dimensions: 'Dimensões',
      trayGeometry: 'Geometria da bandeja',
      compartments: 'Compartimentos',
      lid: 'Tampa',
      cut2d: 'Exportação 2D (corte)',
      bambu: 'Bambu 3MF',
      actions: 'Ações'
    },
    field: {
      width: 'Largura',
      height: 'Altura',
      preserveAspect: 'Manter proporção',
      scale: 'Escala',
      wallHeight: 'Altura da parede',
      wallThickness: 'Espessura da parede',
      bottomThickness: 'Espessura do fundo',
      wallTaper: 'Inclinação da parede',
      cornerRounding: 'Arredondamento de cantos',
      internalDividers: 'Divisórias internas',
      rows: 'Linhas',
      columns: 'Colunas',
      dividerThickness: 'Espessura da divisória',
      generateLid: 'Gerar tampa',
      lidThickness: 'Espessura da tampa',
      clearance: 'Folga',
      lipDepth: 'Profundidade do lábio',
      lipThickness: 'Espessura do lábio',
      kerf: 'Kerf / largura do feixe',
      layerHeightHint: 'Altura de camada (dica)',
      elephantFootHint: 'Pé de elefante (dica)'
    },
    bambu: {
      hint: 'Exporta um ZIP: abra *_tray.3mf na placa 1, adicione placa 2 na Bambu, importe *_lid.3mf. Veja LEIA-ME-Bambu.txt dentro do ZIP.'
    },
    action: {
      reset: 'Restaurar',
      regenerate: 'Regenerar',
      exportTrayStl: 'Exportar STL da bandeja',
      exportLidStl: 'Exportar STL da tampa',
      exportCutSvg: 'Exportar SVG (corte 2D)',
      exportBambuZip: 'Exportar ZIP Bambu (bandeja + tampa)'
    },
    input: {
      dropTitle: 'Arraste um SVG ou silhueta aqui',
      dropHint: 'PNG com transparência funciona melhor; JPEG usa detecção de fundo nos cantos.',
      browse: 'Escolher arquivo…',
      tracing: 'Vetorizando imagem para SVG…',
      exportSvg: 'Exportar SVG',
      replace: 'Substituir',
      sourceImage: 'Imagem original',
      tracedSilhouette: 'Silhueta vetorizada',
      imageTracing: 'Vetorização',
      threshold: 'Limiar',
      simplification: 'Simplificação',
      largestContourOnly: 'Usar apenas o maior contorno',
      retrace: 'Vetorizar de novo',
      shapesToUse: 'Formas usadas ({selected}/{total})',
      contour: 'contorno',
      contours: 'contornos',
      examples: 'Exemplos'
    },
    sample: {
      heart: 'Coração',
      star: 'Estrela',
      'rounded-rect': 'Retângulo arredondado',
      ring: 'Anel (furo)'
    },
    viewer: {
      webglError: 'WebGL não está disponível neste navegador; a visualização 3D não pode ser exibida.',
      top: 'Topo',
      front: 'Frente',
      side: 'Lado',
      iso: 'Iso',
      wireframe: 'Arame',
      resetCamera: 'Resetar câmera',
      generating: 'Gerando geometria…',
      emptyTitle: 'Transforme qualquer SVG em uma bandeja imprimível',
      emptyBody: 'Envie uma silhueta (coração, estrela, logo, letra…) ou use um exemplo. A bandeja oca usa offset real de polígonos, preview 3D e exportação STL watertight.',
      errorTitle: 'Não foi possível gerar uma bandeja válida',
      preview: {
        tray: 'Bandeja',
        lid: 'Tampa',
        both: 'Ambos'
      }
    },
    status: {
      idle: 'Ocioso',
      generating: 'Gerando…',
      ready: 'Modelo pronto',
      error: 'Geometria inválida',
      size: 'Tamanho',
      wall: 'Parede',
      heightAbbr: 'alt',
      thicknessAbbr: 'esp',
      bbox: 'BBox',
      meshOk: 'Malha watertight ✓',
      meshInvalid: 'INVÁLIDA',
      tris: 'tris',
      parts: 'partes',
      export: 'Exportação'
    },
    export: {
      status: {
        idle: 'ocioso',
        exporting: 'exportando',
        done: 'concluído',
        error: 'erro'
      },
      noSvg: 'Não há SVG para exportar.',
      noModel: 'Exportação bloqueada: não há modelo válido.',
      noLid: 'Exportação bloqueada: não há tampa válida.',
      noTray: 'Exportação bloqueada: não há bandeja válida.',
      needLidFor3mf: 'Ative “Gerar tampa” e aguarde uma malha de tampa válida para exportar o ZIP Bambu.',
      noCutGeometry: 'Exportação bloqueada: não há geometria de corte.',
      exportedStl: 'Exportado {name} ({kb} KB, {tris} triângulos)',
      exportedLidStl: 'Exportado {name} ({kb} KB)',
      exportedSvg: 'Exportado {name}',
      exportedCut: 'Exportado {name} ({layers} camada(s), kerf {kerf} mm)',
      exportedBambu: 'Exportado {name}: abra *_tray.3mf, adicione placa 2, importe *_lid.3mf. Veja LEIA-ME-Bambu.txt.{bottomHint}',
      bottomHint: ' Ajuste a espessura do fundo para {mm} mm ({layers}× {layer} mm) se aparecer linha na altura do fundo.',
      unsupportedFile: 'Escolha um SVG ou imagem de silhueta (PNG, JPEG, WebP).'
    }
  }
}
