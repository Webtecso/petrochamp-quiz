export function paginateText(text: string, maxChars: number): string[] {
  const trimmed = (text ?? '').trim()
  if (trimmed.length <= maxChars) return [trimmed]

  // Divide em paragrafos (linhas em branco separam paragrafos) para nunca
  // cortar um paragrafo ao meio entre paginas, a menos que o proprio
  // paragrafo seja maior que maxChars - nesse caso, cai para o corte por
  // frase/espaco como ultimo recurso.
  const paragraphs = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

  const pages: string[] = []
  let currentPage = ''

  function flushCurrentPage(): void {
    if (currentPage.length > 0) {
      pages.push(currentPage.trim())
      currentPage = ''
    }
  }

  function splitLongParagraph(paragraph: string): string[] {
    const sentenceEnders = ['. ', '; ', '! ', '? ']
    const chunks: string[] = []
    let rest = paragraph

    while (rest.length > maxChars) {
      const slice = rest.slice(0, maxChars + 1)

      let cutIndex = -1
      for (const ender of sentenceEnders) {
        const idx = slice.lastIndexOf(ender)
        if (idx > cutIndex) cutIndex = idx + ender.length
      }

      if (cutIndex <= 0 || cutIndex < maxChars * 0.4) {
        const lastSpace = slice.lastIndexOf(' ')
        cutIndex = lastSpace > 0 ? lastSpace + 1 : maxChars
      }

      chunks.push(rest.slice(0, cutIndex).trim())
      rest = rest.slice(cutIndex).trim()
    }

    if (rest.length > 0) chunks.push(rest)
    return chunks
  }

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      // Paragrafo isolado maior que o limite: fecha a pagina atual e
      // divide este paragrafo por frase/espaco como paginas proprias.
      flushCurrentPage()
      const subChunks = splitLongParagraph(paragraph)
      for (const chunk of subChunks) pages.push(chunk)
      continue
    }

    const candidate = currentPage ? currentPage + '\n\n' + paragraph : paragraph
    if (candidate.length > maxChars) {
      flushCurrentPage()
      currentPage = paragraph
    } else {
      currentPage = candidate
    }
  }
  flushCurrentPage()

  return pages.length > 0 ? pages : [trimmed]
}

export const ANALYTIC_PAGE_MAX_CHARS = 420
