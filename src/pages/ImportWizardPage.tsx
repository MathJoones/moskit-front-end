import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Check, ChevronLeft, FileSpreadsheet, RefreshCw, Upload,
} from 'lucide-react'

import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { importService } from '@/services/import.service'
import { connectionService } from '@/services/connection.service'
import { extractErrorMessage } from '@/services/api'
import type { ColumnMapping, ImportEntityType, TransformerType } from '@/types/import.types'

// ── Constantes ────────────────────────────────────────────────

const ENTITY_LABELS: Record<ImportEntityType, string> = {
  contact: 'Contatos',
  company: 'Empresas',
  deal:    'Negócios',
}

const TARGET_FIELDS: Record<ImportEntityType, Array<{ value: string; label: string }>> = {
  contact: [
    { value: 'name',        label: 'Nome' },
    { value: 'email',       label: 'E-mail' },
    { value: 'phone',       label: 'Telefone' },
    { value: 'responsible', label: 'Responsável (ID)' },
    { value: 'origin',      label: 'Origem' },
    { value: 'notes',       label: 'Observações' },
  ],
  company: [
    { value: 'name',        label: 'Nome' },
    { value: 'email',       label: 'E-mail' },
    { value: 'phone',       label: 'Telefone' },
    { value: 'site',        label: 'Site' },
    { value: 'cnpj',        label: 'CNPJ' },
    { value: 'responsible', label: 'Responsável (ID)' },
    { value: 'notes',       label: 'Observações' },
  ],
  deal: [
    { value: 'name',               label: 'Título' },
    { value: 'price',              label: 'Valor (R$)' },
    { value: 'status',             label: 'Status' },
    { value: 'stage',              label: 'Etapa (ID)' },
    { value: 'responsible',        label: 'Responsável (ID)' },
    { value: 'origin',             label: 'Origem' },
    { value: 'previsionCloseDate', label: 'Previsão de fechamento' },
  ],
}

// ── CSV parser (RFC4180, sem dependências) ────────────────────

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const clean = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += ch
      continue
    }
    if (ch === '"') inQuotes = true
    else if (ch === ',' || ch === ';' || ch === '\t') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (ch !== '\r') field += ch
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

// ── Helpers ───────────────────────────────────────────────────

function detectTransformer(colName: string): TransformerType {
  const lc = colName.toLowerCase()
  if (/fone|tel|cel|whats|phone/.test(lc)) return 'phone'
  if (/data|date|nasc|prazo|fechamento|abertura/.test(lc)) return 'date'
  if (/valor|price|preco|custo|receita|amount/.test(lc)) return 'number'
  return 'string'
}

function autoMapField(colName: string, entityType: ImportEntityType): string {
  const lc = colName.toLowerCase()
  const fields = TARGET_FIELDS[entityType]
  const match = fields.find((f) =>
    lc.includes(f.value) ||
    f.value.includes(lc) ||
    f.label.toLowerCase().includes(lc) ||
    lc.includes(f.label.toLowerCase()),
  )
  return match?.value ?? ''
}

interface CsvData {
  headers:  string[]
  preview:  string[][]
  rowCount: number
}

interface MappingRow {
  csv_column:    string
  target_field:  string
  transformer:   TransformerType
  is_required:   boolean
  use_for_dedup: boolean
}

// ── Section wrapper (iOS style — label outside card) ──────────

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          {title}
        </span>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/[0.06] dark:bg-[#1c1e26]">
        {hint && <p className="mb-4 text-[12.5px] text-gray-500 dark:text-gray-400">{hint}</p>}
        {children}
      </div>
    </section>
  )
}

// ── Componente principal ──────────────────────────────────────

export default function ImportWizardPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  // Config
  const [name, setName] = useState('')
  const [entityType, setEntityType] = useState<ImportEntityType>('contact')
  const [connectionId, setConnectionId] = useState('')

  // Arquivo
  const [file, setFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<CsvData | null>(null)

  // Mapeamento
  const [mappings, setMappings] = useState<MappingRow[]>([])

  // Dedup — ids dos target_fields marcados
  const [dedupFields, setDedupFields] = useState<Set<string>>(new Set())

  const [error, setError] = useState<string | null>(null)

  const { data: connections, isLoading: loadingConns } = useQuery({
    queryKey: ['connections'],
    queryFn: () => connectionService.list(),
  })

  const createMutation = useMutation({
    mutationFn: () => {
      const column_mappings: ColumnMapping[] = mappings
        .filter((m) => m.target_field)
        .map((m) => ({
          csv_column:   m.csv_column,
          target_field: m.target_field,
          transformer:  m.transformer,
          is_required:  m.is_required,
        }))
      return importService.create(
        {
          name,
          entity_type: entityType,
          connection_id: connectionId,
          column_mappings,
          dedup_keys: dedupFields.size > 0 ? [...dedupFields] : null,
        },
        file!,
      )
    },
    onSuccess: (job) => navigate(`/imports/${job.id}`),
    onError:   (err: unknown) => setError(extractErrorMessage(err, 'Erro ao iniciar importação')),
  })

  // ── Handlers ──────────────────────────────────────────────

  const processFile = async (f: File) => {
    setFile(f)
    setCsvData(null)
    setMappings([])
    setDedupFields(new Set())
    setError(null)

    if (!f.name.match(/\.(csv|txt)$/i)) {
      setCsvData({ headers: [], preview: [], rowCount: 0 })
      return
    }

    try {
      const text = await f.text()
      const rows = parseCsv(text)
      const [rawHeaders = [], ...dataRows] = rows
      const headers = rawHeaders.map((h) => h.trim()).filter(Boolean)
      const filled = dataRows.filter((r) => r.some((c) => c.trim()))
      const preview = filled.slice(0, 5)

      setCsvData({ headers, preview, rowCount: filled.length })

      setMappings(
        headers.map((col) => ({
          csv_column:    col,
          target_field:  autoMapField(col, entityType),
          transformer:   detectTransformer(col),
          is_required:   false,
          use_for_dedup: false,
        })),
      )
    } catch {
      setError('Não foi possível ler o arquivo. Verifique se é um CSV válido.')
    }
  }

  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) void processFile(f)
  }

  const dragProps = {
    onDragOver:  (e: DragEvent<HTMLElement>) => { e.preventDefault(); setDragging(true) },
    onDragLeave: () => setDragging(false),
    onDrop,
  }

  const updateMapping = (idx: number, patch: Partial<MappingRow>) =>
    setMappings((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))

  const toggleDedup = (field: string) =>
    setDedupFields((prev) => {
      const next = new Set(prev)
      if (next.has(field)) next.delete(field)
      else next.add(field)
      return next
    })

  const mappedFields = mappings.filter((m) => m.target_field)
  const canSubmit = name.trim() && connectionId && file && mappedFields.length > 0

  const selectCls =
    'h-9 w-full rounded-[8px] border border-gray-200 bg-white px-3 text-[13px] text-gray-800 outline-none transition-colors focus:border-brand-500 dark:border-[#2e3040] dark:bg-[#20222d] dark:text-[#f4f5f8]'

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6">

      {/* Back nav */}
      <nav className="flex items-center gap-1 text-[14px] text-gray-500 dark:text-gray-400">
        <button
          onClick={() => navigate('/imports')}
          className="-ml-1.5 inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-brand-600 dark:text-brand-400 transition-colors hover:bg-brand-500/10"
        >
          <ChevronLeft size={18} strokeWidth={2.25} /> Importações
        </button>
      </nav>

      {/* Big header */}
      <header className="mt-3">
        <h1 className="text-[28px] font-bold tracking-tight text-gray-900 dark:text-white">
          Nova Importação
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Faça upload do arquivo CSV, mapeie os campos e inicie a importação para a Ollow.
        </p>
      </header>

      {/* Main grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">

        {/* LEFT: sections */}
        <div className="space-y-5">

          {/* ── 1. Configuração ─────────────────────────────── */}
          <Section
            title="Configuração"
            hint="Dê um nome para identificar esta importação no histórico"
          >
            <div className="space-y-3">
              <Input
                label="Nome da importação"
                placeholder="Ex: Leads Feira Julho 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-gray-600 dark:text-[#b2b9b4]">
                    O que você está importando?
                  </label>
                  <select
                    className={selectCls}
                    value={entityType}
                    onChange={(e) => {
                      setEntityType(e.target.value as ImportEntityType)
                      if (csvData?.headers.length) {
                        setMappings(
                          csvData.headers.map((col) => ({
                            csv_column:    col,
                            target_field:  autoMapField(col, e.target.value as ImportEntityType),
                            transformer:   detectTransformer(col),
                            is_required:   false,
                            use_for_dedup: false,
                          })),
                        )
                        setDedupFields(new Set())
                      }
                    }}
                  >
                    {(Object.entries(ENTITY_LABELS) as [ImportEntityType, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-gray-600 dark:text-[#b2b9b4]">
                    Conta Ollow (conexão API)
                  </label>
                  {loadingConns ? (
                    <div className="h-9 animate-pulse rounded-[8px] bg-gray-100 dark:bg-[#232530]" />
                  ) : (
                    <select
                      className={selectCls}
                      value={connectionId}
                      onChange={(e) => setConnectionId(e.target.value)}
                    >
                      <option value="">Selecione a conta...</option>
                      {(connections ?? []).filter((c) => c.is_active).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.last_test_ok === false ? ' ⚠' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          </Section>

          {/* ── 2. Arquivo ──────────────────────────────────── */}
          <Section
            title="Arquivo"
            hint="CSV (separado por vírgula ou ponto-e-vírgula) ou XLSX"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void processFile(f)
                e.target.value = ''
              }}
            />

            {!file ? (
              /* Drop zone vazio */
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                {...dragProps}
                className={`flex w-full flex-col items-center justify-center gap-2.5 rounded-[12px] border-2 border-dashed px-6 py-12 text-center transition-all ${
                  dragging
                    ? 'border-brand-400 bg-brand-500/[0.07]'
                    : 'border-gray-200 hover:border-brand-400/50 hover:bg-brand-500/[0.03] dark:border-white/[0.08] dark:hover:border-brand-500/40'
                }`}
              >
                <span className={`flex size-12 items-center justify-center rounded-full transition-transform duration-200 ${
                  dragging
                    ? '-translate-y-1 scale-110 bg-brand-500/20 text-brand-400'
                    : 'bg-brand-500/10 text-brand-500'
                }`}>
                  <Upload size={22} />
                </span>
                <span className="text-[15px] text-gray-700 dark:text-[#d6d8e0]">
                  {dragging ? 'Solte o arquivo aqui' : 'Arraste o CSV aqui ou clique para escolher'}
                </span>
                <span className="text-[12.5px] text-gray-400">CSV ou XLSX · até 20 MB</span>
              </button>
            ) : (
              /* Arquivo carregado */
              <div className="space-y-3" {...dragProps}>
                {/* Card do arquivo */}
                <div className={`flex items-center gap-3 rounded-[10px] transition-all ${dragging ? 'ring-2 ring-brand-500 ring-offset-2 dark:ring-offset-[#1c1e26]' : ''}`}>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-500/[0.12] text-brand-600 dark:bg-brand-400/[0.15] dark:text-brand-300">
                    <FileSpreadsheet size={18} strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-gray-800 dark:text-white">
                      {file.name}
                    </p>
                    <p className="text-[12px] text-gray-400 dark:text-[#9298b2]">
                      {csvData && csvData.rowCount > 0
                        ? `${csvData.rowCount.toLocaleString('pt-BR')} linhas · ${csvData.headers.length} colunas`
                        : csvData
                        ? 'Leitura no servidor após envio'
                        : 'Carregando...'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[12px] text-brand-600 transition-colors hover:bg-brand-500/[0.08] dark:text-brand-300 dark:hover:bg-brand-400/[0.12]"
                  >
                    <RefreshCw size={12} /> Trocar
                  </button>
                </div>

                {/* Column type badges */}
                {csvData && csvData.headers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {csvData.headers.slice(0, 8).map((col) => {
                      const transformer = detectTransformer(col)
                      const badgeColor = transformer === 'phone'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : transformer === 'date'
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : transformer === 'number'
                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400'
                      const typeLabel = transformer === 'phone' ? 'TEL'
                        : transformer === 'date' ? 'DATA'
                        : transformer === 'number' ? 'NUM'
                        : 'TEXT'
                      return (
                        <span
                          key={col}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeColor}`}
                        >
                          <span className="font-mono">{typeLabel}</span> {col}
                        </span>
                      )
                    })}
                    {csvData.headers.length > 8 && (
                      <span className="text-[11px] text-gray-400">+{csvData.headers.length - 8}</span>
                    )}
                  </div>
                )}

                {/* Preview table */}
                {csvData && csvData.headers.length > 0 && csvData.preview.length > 0 && (
                  <div className="overflow-x-auto rounded-[10px] border border-gray-100 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                    <table className="w-full text-left font-mono text-[11.5px]">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-white/[0.05]">
                          {csvData.headers.slice(0, 6).map((h, i) => (
                            <th key={i} className="whitespace-nowrap px-2.5 py-1.5 font-medium text-gray-400 dark:text-[#9298b2]">
                              {h}
                            </th>
                          ))}
                          {csvData.headers.length > 6 && (
                            <th className="px-2.5 py-1.5 font-normal text-gray-300 dark:text-[#50536a]">
                              +{csvData.headers.length - 6} cols
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.preview.map((row, ri) => (
                          <tr key={ri} className="border-b border-gray-50 last:border-0 dark:border-white/[0.03]">
                            {csvData.headers.slice(0, 6).map((_, ci) => (
                              <td key={ci} className="max-w-[160px] truncate whitespace-nowrap px-2.5 py-1.5 text-gray-600 dark:text-[#d6d8e0]">
                                {row[ci] ?? ''}
                              </td>
                            ))}
                            {csvData.headers.length > 6 && <td />}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvData.rowCount > 5 && (
                      <p className="border-t border-gray-50 px-2.5 py-1.5 text-[11px] text-gray-300 dark:border-white/[0.03] dark:text-[#50536a]">
                        Mostrando 5 de {csvData.rowCount.toLocaleString('pt-BR')} linhas
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* ── 3. Relacionar colunas (aparece após upload de CSV) */}
          {csvData && csvData.headers.length > 0 && (
            <Section
              title="Relacionar colunas"
              hint="Para cada coluna do seu arquivo, selecione o campo correspondente na Ollow. Colunas sem campo serão ignoradas."
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 text-left dark:border-white/[0.05]">
                      <th className="pb-2 pr-3 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-[#9298b2]">
                        Coluna do arquivo
                      </th>
                      <th className="pb-2 pr-2 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-[#9298b2]">
                        Exemplo
                      </th>
                      <th className="pb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-[#9298b2]">
                        Campo na Ollow
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-white/[0.03]">
                    {mappings.map((row, idx) => {
                      const sample = csvData.preview[0]?.[idx] ?? ''
                      return (
                        <tr key={idx}>
                          {/* Coluna do arquivo */}
                          <td className="py-2 pr-3">
                            <span className="inline-flex items-center gap-1.5 rounded-[6px] bg-gray-50 px-2 py-1 font-mono text-[12px] text-gray-700 dark:bg-white/[0.05] dark:text-[#d6d8e0]">
                              {row.csv_column}
                            </span>
                          </td>
                          {/* Exemplo de valor */}
                          <td className="py-2 pr-3">
                            <span className="max-w-[100px] truncate font-mono text-[11px] text-gray-400 dark:text-[#9298b2]">
                              {sample || '—'}
                            </span>
                          </td>
                          {/* Campo alvo + transformer badge */}
                          <td className="py-2">
                            <div className="flex items-center gap-1.5">
                              <select
                                className={selectCls + ' max-w-[220px]'}
                                value={row.target_field}
                                onChange={(e) => {
                                  updateMapping(idx, { target_field: e.target.value })
                                  if (row.target_field && dedupFields.has(row.target_field)) {
                                    toggleDedup(row.target_field)
                                  }
                                }}
                              >
                                <option value="">— ignorar esta coluna —</option>
                                {TARGET_FIELDS[entityType].map((f) => (
                                  <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                              </select>
                              <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-white/[0.05] dark:text-gray-500">
                                {row.transformer}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {mappedFields.length > 0 && (
                <p className="mt-3 text-[12px] text-gray-400 dark:text-[#9298b2]">
                  <span className="font-medium text-brand-600 dark:text-brand-300">{mappedFields.length}</span>{' '}
                  de {mappings.length} colunas mapeadas
                </p>
              )}
            </Section>
          )}

          {/* ── 4. Verificação de duplicatas ──────────────────── */}
          {mappedFields.length > 0 && (
            <Section
              title="Verificação de duplicatas"
              hint="Antes de criar um registro, o sistema verifica se já existe outro com os mesmos valores nos campos marcados. Deixe em branco para sempre criar novos."
            >
              <div className="flex flex-wrap gap-2">
                {mappedFields.map((m) => {
                  const label = TARGET_FIELDS[entityType].find((f) => f.value === m.target_field)?.label ?? m.target_field
                  const active = dedupFields.has(m.target_field)
                  return (
                    <button
                      key={m.target_field}
                      type="button"
                      onClick={() => toggleDedup(m.target_field)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-all ${
                        active
                          ? 'bg-brand-500/[0.15] text-brand-700 ring-1 ring-brand-500/30 dark:bg-brand-400/[0.2] dark:text-brand-300 dark:ring-brand-400/30'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-white/[0.04] dark:text-[#9298b2] dark:hover:bg-white/[0.07]'
                      }`}
                    >
                      {active && <Check size={11} strokeWidth={2.5} />}
                      {label}
                    </button>
                  )
                })}
              </div>
              {dedupFields.size === 0 && (
                <p className="mt-2 text-[12px] text-gray-400 dark:text-[#9298b2]">
                  Nenhum campo selecionado — todos os registros serão criados.
                </p>
              )}
              {dedupFields.size > 0 && (
                <p className="mt-2 text-[12px] text-gray-400 dark:text-[#9298b2]">
                  Registros com mesmo{' '}
                  <strong className="text-gray-600 dark:text-[#d6d8e0]">
                    {[...dedupFields]
                      .map((f) => TARGET_FIELDS[entityType].find((t) => t.value === f)?.label ?? f)
                      .join(' + ')}
                  </strong>{' '}
                  serão ignorados.
                </p>
              )}
            </Section>
          )}

        </div>

        {/* RIGHT: sticky sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-16 lg:self-start">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/[0.06] dark:bg-[#1c1e26]">
            <h3 className="mb-4 text-sm font-semibold text-gray-800 dark:text-white">Resumo</h3>

            {/* Checklist */}
            <ul className="space-y-2.5 mb-5">
              {[
                { label: 'Nome da importação', done: !!name.trim() },
                { label: 'Conta Ollow',        done: !!connectionId },
                { label: 'Arquivo CSV',         done: !!file },
                { label: 'Colunas mapeadas',    done: mappedFields.length > 0 },
              ].map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-[13px]">
                  <span className={`flex size-4 shrink-0 items-center justify-center rounded-full ${
                    item.done
                      ? 'bg-brand-500 text-white'
                      : 'border border-gray-300 dark:border-white/[0.15]'
                  }`}>
                    {item.done && <Check size={10} strokeWidth={3} />}
                  </span>
                  <span className={item.done ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>

            {/* Stats */}
            {csvData && csvData.rowCount > 0 && (
              <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-100 bg-gray-100 dark:border-white/[0.04] dark:bg-white/[0.04]">
                {[
                  { label: 'Linhas',   value: csvData.rowCount.toLocaleString('pt-BR') },
                  { label: 'Colunas',  value: csvData.headers.length },
                  { label: 'Mapeadas', value: mappedFields.length },
                  { label: 'Dedup',    value: dedupFields.size },
                ].map((s) => (
                  <div key={s.label} className="bg-white px-3 py-2 dark:bg-[#1c1e26]">
                    <p className="text-[10.5px] text-gray-400 dark:text-gray-500">{s.label}</p>
                    <p className="font-mono text-base font-semibold tabular-nums text-gray-800 dark:text-white">{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Error alert */}
            {error && (
              <Alert variant="error" onDismiss={() => setError(null)} className="mb-3">
                {error}
              </Alert>
            )}

            {/* Submit button */}
            <button
              onClick={() => {
                if (!canSubmit) return
                setError(null)
                createMutation.mutate()
              }}
              disabled={!canSubmit || createMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:pointer-events-none disabled:opacity-40 dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              {createMutation.isPending ? (
                <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Upload size={16} />
              )}
              {createMutation.isPending ? 'Iniciando...' : 'Iniciar Importação'}
            </button>

            {!canSubmit && (
              <p className="mt-2 text-center text-[11.5px] text-gray-400 dark:text-gray-500">
                Complete os itens acima para continuar
              </p>
            )}
          </div>
        </aside>

      </div>
    </div>
  )
}
