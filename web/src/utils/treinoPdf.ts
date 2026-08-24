import { jsPDF } from 'jspdf'

export interface TreinoPdfExercicio {
  nome: string
  sets: number
  reps: number
  pesoKg: number
  imageDataUrl?: string
  substitutos: string[]
}

export interface TreinoPdfGrupo {
  categoriaNome: string
  exercicios: TreinoPdfExercicio[]
}

export interface TreinoPdfParams {
  treinoNome: string
  dataGeracao: string
  grupos: TreinoPdfGrupo[]
}

const PAGE_MARGIN = 40
const IMAGE_SIZE = 42

const COLOR = {
  background: '#0f1712',
  border: '#26332c',
  primary: '#1fd08f',
  text: '#f4f7f5',
  textMuted: '#93a89c',
  warning: '#e0a548',
} as const

// jsPDF only draws vector shapes/text — it has no access to the MDI icon font the rest of the
// app uses, so the couple of icons that matter here (dumbbell, swap) are drawn by hand instead.
function drawDumbbellIcon(pdf: jsPDF, cx: number, cy: number, size: number, color: string): void {
  const barW = size * 0.5
  const barH = size * 0.16
  const weightW = size * 0.18
  const weightH = size * 0.62

  pdf.setFillColor(color)
  pdf.roundedRect(cx - barW / 2, cy - barH / 2, barW, barH, barH / 2, barH / 2, 'F')
  pdf.roundedRect(cx - barW / 2 - weightW - 1, cy - weightH / 2, weightW, weightH, 1.5, 1.5, 'F')
  pdf.roundedRect(cx + barW / 2 + 1, cy - weightH / 2, weightW, weightH, 1.5, 1.5, 'F')
}

function drawSwapIcon(pdf: jsPDF, x: number, y: number, size: number, color: string): void {
  pdf.setDrawColor(color)
  pdf.setFillColor(color)
  pdf.setLineWidth(0.9)

  const shaft = size * 0.55
  const head = size * 0.32
  const gap = size * 0.38
  const topY = y - gap
  const bottomY = y

  pdf.line(x, topY, x + shaft, topY)
  pdf.triangle(x + shaft, topY - head / 2, x + shaft, topY + head / 2, x + shaft + head, topY, 'F')

  pdf.line(x + head, bottomY, x + head + shaft, bottomY)
  pdf.triangle(x + head, bottomY - head / 2, x + head, bottomY + head / 2, x, bottomY, 'F')
}

function drawBackground(pdf: jsPDF): void {
  const width = pdf.internal.pageSize.getWidth()
  const height = pdf.internal.pageSize.getHeight()
  pdf.setFillColor(COLOR.background)
  pdf.rect(0, 0, width, height, 'F')
}

function truncateToWidth(pdf: jsPDF, text: string, maxWidth: number): string {
  if (pdf.getTextWidth(text) <= maxWidth) return text
  let result = text
  while (result.length > 1 && pdf.getTextWidth(`${result}…`) > maxWidth) {
    result = result.slice(0, -1)
  }
  return `${result}…`
}

function ensureSpace(pdf: jsPDF, y: number, needed: number): number {
  const pageHeight = pdf.internal.pageSize.getHeight()
  if (y + needed <= pageHeight - PAGE_MARGIN) return y
  pdf.addPage()
  drawBackground(pdf)
  return PAGE_MARGIN
}

function drawHeader(pdf: jsPDF, treinoNome: string, dataGeracao: string, totalExercicios: number): number {
  const pageWidth = pdf.internal.pageSize.getWidth()
  let y = PAGE_MARGIN

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(COLOR.textMuted)
  pdf.text('GYM BRO', PAGE_MARGIN, y)

  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(COLOR.text)
  pdf.text(`Gerado em ${dataGeracao}`, pageWidth - PAGE_MARGIN, y, { align: 'right' })

  y += 24
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  pdf.setTextColor(COLOR.text)
  pdf.text(truncateToWidth(pdf, treinoNome, pageWidth - PAGE_MARGIN * 2), PAGE_MARGIN, y)

  y += 18
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(COLOR.textMuted)
  pdf.text(`${totalExercicios} exercício${totalExercicios === 1 ? '' : 's'}`, PAGE_MARGIN, y)

  return y + 24
}

function drawGrupoHeader(pdf: jsPDF, grupo: TreinoPdfGrupo, y: number): number {
  const pageWidth = pdf.internal.pageSize.getWidth()
  y = ensureSpace(pdf, y, 28)

  pdf.setFillColor(COLOR.primary)
  pdf.circle(PAGE_MARGIN + 8, y - 4, 8, 'F')
  drawDumbbellIcon(pdf, PAGE_MARGIN + 8, y - 4, 9, COLOR.background)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.setTextColor(COLOR.text)
  pdf.text(grupo.categoriaNome, PAGE_MARGIN + 22, y)

  const count = grupo.exercicios.length
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(COLOR.textMuted)
  pdf.text(`${count} exercício${count === 1 ? '' : 's'}`, pageWidth - PAGE_MARGIN, y, { align: 'right' })

  y += 10
  pdf.setDrawColor(COLOR.border)
  pdf.setLineWidth(0.75)
  pdf.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y)

  return y + 20
}

function estimateRowHeight(exercicio: TreinoPdfExercicio): number {
  const base = Math.max(IMAGE_SIZE, 40)
  const substitutosLines = exercicio.substitutos.length ? 14 + exercicio.substitutos.length * 13 : 0
  return base + substitutosLines + 14
}

function drawExercicioRow(pdf: jsPDF, exercicio: TreinoPdfExercicio, y: number): number {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const rowHeight = estimateRowHeight(exercicio)
  y = ensureSpace(pdf, y, rowHeight)

  const imageX = PAGE_MARGIN
  const textX = PAGE_MARGIN + IMAGE_SIZE + 14
  const statsX = pageWidth - PAGE_MARGIN

  if (exercicio.imageDataUrl) {
    try {
      pdf.addImage(exercicio.imageDataUrl, 'JPEG', imageX, y, IMAGE_SIZE, IMAGE_SIZE, undefined, 'MEDIUM')
    } catch {
      pdf.setFillColor(COLOR.border)
      pdf.roundedRect(imageX, y, IMAGE_SIZE, IMAGE_SIZE, 4, 4, 'F')
      drawDumbbellIcon(pdf, imageX + IMAGE_SIZE / 2, y + IMAGE_SIZE / 2, IMAGE_SIZE * 0.5, COLOR.textMuted)
    }
  } else {
    pdf.setFillColor(COLOR.border)
    pdf.roundedRect(imageX, y, IMAGE_SIZE, IMAGE_SIZE, 4, 4, 'F')
    drawDumbbellIcon(pdf, imageX + IMAGE_SIZE / 2, y + IMAGE_SIZE / 2, IMAGE_SIZE * 0.5, COLOR.textMuted)
  }

  const nomeMaxWidth = statsX - IMAGE_SIZE - 150 - textX
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(COLOR.text)
  pdf.text(truncateToWidth(pdf, exercicio.nome, Math.max(nomeMaxWidth, 60)), textX, y + 13)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(COLOR.textMuted)
  pdf.text(`${exercicio.sets}x${exercicio.reps} · ${exercicio.pesoKg}kg`, textX, y + 27)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(COLOR.text)
  pdf.text(`${exercicio.sets} séries   ${exercicio.reps} reps`, statsX - 55, y + 13, { align: 'right' })
  pdf.setTextColor(COLOR.primary)
  pdf.setFont('helvetica', 'bold')
  pdf.text(`${exercicio.pesoKg} kg`, statsX, y + 13, { align: 'right' })

  let subY = y + 41
  if (exercicio.substitutos.length) {
    drawSwapIcon(pdf, textX, subY - 2, 11, COLOR.warning)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(COLOR.warning)
    pdf.text('Substitutos:', textX + 15, subY)
    subY += 13
    pdf.setFont('helvetica', 'normal')
    for (const sub of exercicio.substitutos) {
      pdf.text(`• ${sub}`, textX + 6, subY)
      subY += 13
    }
  }

  return Math.max(y + IMAGE_SIZE, subY) + 14
}

export function generateTreinoPdf(params: TreinoPdfParams): void {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  drawBackground(pdf)

  const totalExercicios = params.grupos.reduce((total, grupo) => total + grupo.exercicios.length, 0)
  let y = drawHeader(pdf, params.treinoNome, params.dataGeracao, totalExercicios)

  for (const grupo of params.grupos) {
    y = drawGrupoHeader(pdf, grupo, y)
    for (const exercicio of grupo.exercicios) {
      y = drawExercicioRow(pdf, exercicio, y)
    }
    y += 10
  }

  if (!params.grupos.length) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    pdf.setTextColor(COLOR.textMuted)
    pdf.text('Este treino ainda não tem exercícios vinculados.', PAGE_MARGIN, y)
  }

  const safeName = params.treinoNome.replace(/[\\/:*?"<>|]/g, '-')
  pdf.save(`${safeName} - ${params.dataGeracao.replaceAll('/', '-')}.pdf`)
}
