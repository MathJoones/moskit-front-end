import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { importService } from '@/services/import.service'
import { connectionService } from '@/services/connection.service'
import { extractErrorMessage } from '@/services/api'
import type { ColumnMapping, ImportEntityType, TransformerType } from '@/types/import.types'

// ── Constantes ───────────────────────────────────────────────
const ENTITY_LABELS: Record<ImportEntityType, string> = {
  contact: 'Contatos',
  company: 'Empresas',
  deal:    'Negócios',
}

const TARGET_FIELDS: Record<ImportEntityType, Array<{ value: string; label: string }>> = {
  contact: [
    { value: 'name',        label: 'Nome' },
    { value: 'email',       label: 'Email' },
    { value: 'phone',       label: 'Telefone' },
    { value: 'responsible', label: 'Responsável (ID)' },
    { value: 'notes',       label: 'Observações' },
    { value: 'origin',      label: 'Origem' },
  ],
  company: [
    { value: 'name',        label: 'Nome' },
    { value: 'email',       label: 'Email' },
    { value: 'phone',       label: 'Telefone' },
    { value: 'site',        label: 'Site' },
    { value: 'cnpj',        label: 'CNPJ' },
    { value: 'responsible', label: 'Responsável (ID)' },
    { value: 'notes',       label: 'Observações' },
  ],
  deal: [
    { value: 'name',               label: 'Nome' },
    { value: 'price',              label: 'Valor' },
    { value: 'status',             label: 'Status' },
    { value: 'stage',              label: 'Etapa (ID)' },
    { value: 'responsible',        label: 'Responsável (ID)' },
    { value: 'origin',             label: 'Origem' },
    { value: 'previsionCloseDate', label: 'Previsão Fechamento' },
  ],
}

const TRANSFORMERS: Array<{ value: TransformerType; label: string }> = [
  { value: 'string', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date',   label: 'Data' },
  { value: 'phone',  label: 'Telefone' },
  { value: 'enum',   label: 'Enum' },
]

const STEPS = ['Upload', 'Mapeamento', 'Revisão']

// ── Helpers ──────────────────────────────────────────────────
async function detectCsvHeaders(file: File): Promise<string[]> {
  if (!file.name.match(/\.(csv|txt)$/i)) return []
  try {
    const text = await file.text()
    const firstLine = text.split(/\r?\n/)[0] ?? ''
    const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0, '|': 0 }
    for (const ch of firstLine) if (ch in counts) counts[ch]++
    const delim = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    return firstLine
      .split(delim)
      .map((h) => h.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
  } catch {
    return []
  }
}

function buildDefaultMappings(
  csvColumns: string[],
  entityType: ImportEntityType,
): MappingRow[] {
  const fields = TARGET_FIELDS[entityType]
  return csvColumns.map((col) => {
    const lc = col.toLowerCase()
    const auto = fields.find((f) => lc.includes(f.value) || f.label.toLowerCase().includes(lc))
    return {
      csv_column:   col,
      target_field: auto?.value ?? '',
      transformer:  'string' as TransformerType,
      is_required:  false,
      use_for_dedup: false,
    }
  })
}

// ── Types locais ─────────────────────────────────────────────
interface MappingRow {
  csv_column:    string
  target_field:  string
  transformer:   TransformerType
  is_required:   boolean
  use_for_dedup: boolean
}

// ── Step indicator ───────────────────────────────────────────
function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const idx = i + 1
        const done = idx < current
        const active = idx === current
        return (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold
              ${done ? 'bg-green-500 text-white' : active ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'}`}
            >
              {done ? <Check size={13} /> : idx}
            </div>
            <span className={`hidden text-sm sm:block ${active ? 'font-medium text-gray-800' : 'text-gray-400'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-8 ${idx < current ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────
export default function ImportWizardPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 1
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [entityType, setEntityType] = useState<ImportEntityType>('contact')
  const [connectionId, setConnectionId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [csvColumns, setCsvColumns] = useState<string[]>([])

  // Step 2
  const [mappings, setMappings] = useState<MappingRow[]>([])

  // Global
  const [error, setError] = useState<string | null>(null)

  const { data: connections, isLoading: loadingConns } = useQuery({
    queryKey: ['connections'],
    queryFn: () => connectionService.list(),
  })

  const createMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        entity_type: entityType,
        connection_id: connectionId,
        column_mappings: mappings
          .filter((m) => m.csv_column && m.target_field)
          .map<ColumnMapping>((m) => ({
            csv_column:    m.csv_column,
            target_field:  m.target_field,
            transformer:   m.transformer,
            is_required:   m.is_required,
          })),
        dedup_keys: mappings.some((m) => m.use_for_dedup)
          ? mappings.filter((m) => m.use_for_dedup && m.target_field).map((m) => m.target_field)
          : null,
      }
      return importService.create(payload, file!)
    },
    onSuccess: (job) => navigate(`/imports/${job.id}`),
    onError: (err: unknown) => setError(extractErrorMessage(err, 'Erro ao iniciar importação')),
  })

  // ── Handlers ──────────────────────────────────────────────

  const handleFileChange = async (f: File | null) => {
    setFile(f)
    if (!f) { setCsvColumns([]); return }
    const cols = await detectCsvHeaders(f)
    setCsvColumns(cols)
  }

  const handleStep1Next = () => {
    if (!name.trim()) { setError('Informe o nome da importação'); return }
    if (!connectionId) { setError('Selecione uma conexão'); return }
    if (!file)         { setError('Selecione um arquivo'); return }
    setError(null)
    const rows = csvColumns.length > 0
      ? buildDefaultMappings(csvColumns, entityType)
      : [{ csv_column: '', target_field: '', transformer: 'string' as TransformerType, is_required: false, use_for_dedup: false }]
    setMappings(rows)
    setStep(2)
  }

  const handleStep2Next = () => {
    const valid = mappings.filter((m) => m.csv_column && m.target_field)
    if (valid.length === 0) {
      setError('Configure ao menos um mapeamento com coluna e campo preenchidos')
      return
    }
    setError(null)
    setStep(3)
  }

  const updateMapping = (idx: number, patch: Partial<MappingRow>) =>
    setMappings((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))

  const removeMapping = (idx: number) =>
    setMappings((prev) => prev.filter((_, i) => i !== idx))

  const addMapping = () =>
    setMappings((prev) => [
      ...prev,
      { csv_column: '', target_field: '', transformer: 'string', is_required: false, use_for_dedup: false },
    ])

  const selectStyle = 'h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs outline-none focus:border-brand-500'

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (step === 1 ? navigate('/imports') : setStep((s) => (s - 1) as 1 | 2 | 3))}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Nova Importação</h2>
            <p className="text-xs text-gray-400">Configure e execute a importação em 3 passos</p>
          </div>
        </div>
        <StepBar current={step} />
      </div>

      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">1. Configuração Básica</h3>

          <Input
            label="Nome da importação"
            placeholder="Ex: Leads Junho 2026"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Entidade</label>
              <select
                className={selectStyle + ' h-9'}
                value={entityType}
                onChange={(e) => setEntityType(e.target.value as ImportEntityType)}
              >
                {(Object.entries(ENTITY_LABELS) as [ImportEntityType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Conexão Moskit</label>
              {loadingConns ? (
                <div className="h-9 animate-pulse rounded-md bg-gray-100" />
              ) : (
                <select
                  className={selectStyle + ' h-9'}
                  value={connectionId}
                  onChange={(e) => setConnectionId(e.target.value)}
                >
                  <option value="">Selecione uma conexão...</option>
                  {(connections ?? []).filter((c) => c.is_active).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Upload zone */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Arquivo (CSV ou XLSX)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600"
            >
              <Upload size={22} />
              {file ? (
                <span className="font-medium text-brand-700">{file.name}</span>
              ) : (
                <span>Clique para selecionar ou arraste o arquivo</span>
              )}
              {file && csvColumns.length > 0 && (
                <span className="text-xs text-green-600">{csvColumns.length} colunas detectadas</span>
              )}
              {file && csvColumns.length === 0 && file.name.match(/\.(xlsx|xls)$/i) && (
                <span className="text-xs text-yellow-600">XLSX — configure as colunas no próximo passo</span>
              )}
            </button>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleStep1Next}>
              Próximo <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2 ── */}
      {step === 2 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">2. Mapeamento de Campos</h3>
            <span className="text-xs text-gray-400">
              Entidade: <strong>{ENTITY_LABELS[entityType]}</strong>
            </span>
          </div>

          <p className="text-xs text-gray-500">
            Para cada coluna do arquivo, selecione o campo correspondente na Moskit.
            Marque <strong>Dedup</strong> para usar o campo na verificação de duplicatas.
          </p>

          {/* Tabela de mapeamento */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 pr-3 font-medium w-1/4">Coluna do arquivo</th>
                  <th className="pb-2 pr-3 font-medium w-1/4">Campo Moskit</th>
                  <th className="pb-2 pr-3 font-medium w-1/6">Transformer</th>
                  <th className="pb-2 pr-3 font-medium text-center w-16">Obrig.</th>
                  <th className="pb-2 pr-3 font-medium text-center w-16">Dedup</th>
                  <th className="pb-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mappings.map((row, idx) => (
                  <tr key={idx}>
                    <td className="py-2 pr-3">
                      <input
                        className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs outline-none focus:border-brand-500"
                        value={row.csv_column}
                        onChange={(e) => updateMapping(idx, { csv_column: e.target.value })}
                        placeholder="Nome da coluna"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        className={selectStyle}
                        value={row.target_field}
                        onChange={(e) => updateMapping(idx, { target_field: e.target.value })}
                      >
                        <option value="">— ignorar —</option>
                        {TARGET_FIELDS[entityType].map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        className={selectStyle}
                        value={row.transformer}
                        onChange={(e) => updateMapping(idx, { transformer: e.target.value as TransformerType })}
                      >
                        {TRANSFORMERS.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3 text-center">
                      <input
                        type="checkbox"
                        checked={row.is_required}
                        onChange={(e) => updateMapping(idx, { is_required: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600"
                      />
                    </td>
                    <td className="py-2 pr-3 text-center">
                      <input
                        type="checkbox"
                        checked={row.use_for_dedup}
                        disabled={!row.target_field}
                        onChange={(e) => updateMapping(idx, { use_for_dedup: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 disabled:opacity-40"
                      />
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => removeMapping(idx)}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={addMapping}
            className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800"
          >
            <Plus size={13} /> Adicionar linha
          </button>

          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={() => setStep(1)}>
              <ArrowLeft size={14} /> Voltar
            </Button>
            <Button onClick={handleStep2Next}>
              Revisar <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3 ── */}
      {step === 3 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <h3 className="text-sm font-semibold text-gray-700">3. Revisão</h3>

          {/* Resumo */}
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-xs text-gray-500 mb-0.5">Nome</p>
              <p className="font-medium text-gray-800">{name}</p>
            </div>
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-xs text-gray-500 mb-0.5">Entidade</p>
              <p className="font-medium text-gray-800">{ENTITY_LABELS[entityType]}</p>
            </div>
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-xs text-gray-500 mb-0.5">Arquivo</p>
              <p className="font-medium text-gray-800 truncate">{file?.name}</p>
            </div>
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-xs text-gray-500 mb-0.5">Deduplicação</p>
              <p className="font-medium text-gray-800">
                {mappings.some((m) => m.use_for_dedup)
                  ? mappings.filter((m) => m.use_for_dedup && m.target_field).map((m) => m.target_field).join(', ')
                  : 'Desativada'}
              </p>
            </div>
          </div>

          {/* Mapeamentos */}
          <div>
            <p className="mb-2 text-xs font-semibold text-gray-600">
              Mapeamentos ({mappings.filter((m) => m.csv_column && m.target_field).length} ativos)
            </p>
            <div className="overflow-x-auto rounded-md border border-gray-100">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr className="text-left text-gray-500">
                    <th className="px-3 py-2 font-medium">Coluna do arquivo</th>
                    <th className="px-3 py-2 font-medium">Campo Moskit</th>
                    <th className="px-3 py-2 font-medium">Transformer</th>
                    <th className="px-3 py-2 font-medium text-center">Obrig.</th>
                    <th className="px-3 py-2 font-medium text-center">Dedup</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {mappings
                    .filter((m) => m.csv_column && m.target_field)
                    .map((m, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-gray-700">{m.csv_column}</td>
                        <td className="px-3 py-2 text-gray-700">
                          {TARGET_FIELDS[entityType].find((f) => f.value === m.target_field)?.label ?? m.target_field}
                        </td>
                        <td className="px-3 py-2 text-gray-500">{m.transformer}</td>
                        <td className="px-3 py-2 text-center">{m.is_required ? '✓' : '—'}</td>
                        <td className="px-3 py-2 text-center">{m.use_for_dedup ? '✓' : '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={() => setStep(2)}>
              <ArrowLeft size={14} /> Voltar
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
            >
              <Upload size={14} /> Iniciar Importação
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
