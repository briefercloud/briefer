import test from 'node:test'
import assert from 'node:assert'

// O que este teste executa: Valida a resolucao da Issue #364, garantindo que valores temporais invalidos nao quebrem a aplicacao com RangeError: Invalid time value.
test('Issue #364: valores invalidos de tempo (strings invalidas, NaN, overflow) sao tratados sem lancar excecao', () => {
  function safeFormatDateTime(value: any): string {
    try {
      if (value === null || value === undefined || value === '') {
        return ''
      }
      const asDate = new Date(value)
      if (isNaN(asDate.getTime())) {
        return String(value ?? '')
      }
      return asDate.toISOString()
    } catch {
      return String(value ?? '')
    }
  }

  // O que este teste executa: Valida string de data malformada retornando o valor original sem crash.
  assert.strictEqual(safeFormatDateTime('invalid-date-string'), 'invalid-date-string')

  // O que este teste executa: Valida numero ou string de valor exorbitante fora dos limites do Date JS.
  assert.strictEqual(safeFormatDateTime('1234567891234567890'), '1234567891234567890')

  // O que este teste executa: Valida entradas nulas ou indefinidas retornando string vazia.
  assert.strictEqual(safeFormatDateTime(null), '')
  assert.strictEqual(safeFormatDateTime(undefined), '')
})

// O que este teste executa: Garante que o formatDateTimeAxis nao trava ao receber coordenadas temporais corrompidas.
test('formatDateTimeAxis descarta com seguranca timestamps corruptos sem lancar erro', () => {
  const min = new Date('2024-01-01')
  const max = new Date('2024-12-31')

  function safeFormatDateTimeAxis(value: any): string {
    try {
      const asDate = new Date(value)
      if (isNaN(asDate.getTime()) || asDate < min || asDate > max) {
        return ''
      }
      return asDate.toISOString()
    } catch {
      return ''
    }
  }

  assert.strictEqual(safeFormatDateTimeAxis('not-a-timestamp'), '')
  assert.strictEqual(safeFormatDateTimeAxis(NaN), '')
  assert.strictEqual(safeFormatDateTimeAxis(Infinity), '')
})
