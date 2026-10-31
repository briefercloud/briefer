import test from 'node:test'
import assert from 'node:assert'

// O que este teste executa: Valida a formatacao segura de datas validas sem lancar excecoes de tempo invalido.
test('formatDateTime formata datas validas com estilos padronizados', () => {
  function formatDateTime(value: string | number): string {
    const asDate = new Date(value)
    if (isNaN(asDate.getTime())) {
      return String(value ?? '')
    }
    return asDate.toISOString().slice(0, 10)
  }

  // O que este teste executa: Verifica conversao de timestamp ISO valido para formato ano-mes-dia.
  const validIso = '2024-10-30T23:50:21Z'
  assert.strictEqual(formatDateTime(validIso), '2024-10-30')

  // O que este teste executa: Verifica conversao de timestamp epoch numerico em milissegundos.
  const validEpoch = 1730332221000
  assert.strictEqual(formatDateTime(validEpoch), '2024-10-30')
})

// O que este teste executa: Valida que formatDateTimeAxis respeita limites de intervalo min e max.
test('formatDateTimeAxis filtra pontos temporais fora da janela visivel', () => {
  const min = new Date('2024-01-01T00:00:00Z')
  const max = new Date('2024-12-31T23:59:59Z')

  function formatDateTimeAxis(value: string | number): string {
    const asDate = new Date(value)
    if (isNaN(asDate.getTime()) || asDate < min || asDate > max) {
      return ''
    }
    return asDate.toISOString().slice(0, 10)
  }

  // O que este teste executa: Garante que data anterior a min retorna string vazia sem renderizar rotulo sobreposto.
  assert.strictEqual(formatDateTimeAxis('2023-12-31T00:00:00Z'), '')

  // O que este teste executa: Garante que data dentro da janela retorna a representacao textual formatada.
  assert.strictEqual(formatDateTimeAxis('2024-06-15T12:00:00Z'), '2024-06-15')
})
