import * as XLSX from 'xlsx';
import { Client } from '../types';
import { dedupeClients, normalizeClientPhone } from './clients';

/**
 * 24 colunas originais do layout de exportação do AppBarber / sistemas similares.
 */
export const APPBARBER_24_COLUMNS = [
  'Nome',
  'CPF',
  'Email',
  'DDI',
  'Celular',
  'Telefone',
  'Login',
  'Pontos',
  'Sexo',
  'Nascimento',
  'Endereco',
  'Bairro',
  'Cidade',
  'Estado',
  'Cep',
  'Complemento',
  'Número',
  'Obs',
  'RG',
  'Imagem',
  'Cadastro',
  'DiasSemVir',
  'UltimaVisita',
  'ComoSoube',
] as const;

/**
 * Colunas sensíveis ou desnecessárias que o AgendAI NUNCA deve importar no CRM.
 * Proteção de privacidade por design (LGPD / Segurança).
 */
export const SENSITIVE_OR_DISCARDED_COLUMNS = [
  'cpf',
  'rg',
  'sexo',
  'nascimento',
  'data de nascimento',
  'datanascimento',
  'endereco',
  'endereço',
  'bairro',
  'cidade',
  'estado',
  'cep',
  'complemento',
  'numero',
  'número',
  'login',
  'senha',
  'imagem',
  'foto',
  'diassemvir',
  'comosoube',
] as const;

export const normalizeImportHeader = (value: string): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');

/**
 * Verifica se os cabeçalhos correspondem ao layout específico de 24 colunas do AppBarber.
 */
export const isAppBarber24ColumnLayout = (headers: string[]): boolean => {
  const normalizedHeaders = headers.map(normalizeImportHeader);
  const expected = APPBARBER_24_COLUMNS.map(normalizeImportHeader);
  const matchCount = expected.filter((col) => normalizedHeaders.includes(col)).length;
  // Layout reconhecido se tem ao menos 18 das 24 colunas esperadas e contém as colunas-chave
  return (
    matchCount >= 18 &&
    normalizedHeaders.includes('nome') &&
    (normalizedHeaders.includes('celular') || normalizedHeaders.includes('telefone'))
  );
};

export const readImportValue = (row: Record<string, unknown>, aliases: string[]): string => {
  const target = aliases.map(normalizeImportHeader);
  const key = Object.keys(row).find((column) => target.includes(normalizeImportHeader(column)));
  if (!key) return '';
  const val = row[key];
  if (val === null || val === undefined) return '';
  return String(val).trim();
};

/**
 * Normaliza e formata o telefone para exibição limpa no padrão brasileiro (XX) XXXXX-XXXX ou (XX) XXXX-XXXX.
 */
export const formatDisplayPhone = (rawPhone: string, ddi?: string): string => {
  const trimmed = String(rawPhone || '').trim();
  if (!trimmed) return 'Não informado';

  let digits = normalizeClientPhone(trimmed);

  // Se o DDI foi passado separadamente e o celular veio apenas com 8 ou 9 dígitos sem DDD,
  // ou se veio com 55 prefixado, normalizeClientPhone já tratou.
  if (!digits) {
    return trimmed || 'Não informado';
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return trimmed;
};

/**
 * Normaliza e valida e-mail. Retorna undefined se inválido ou vazio.
 */
export const normalizeImportEmail = (value?: string): string | undefined => {
  if (!value) return undefined;
  const clean = value.trim().toLowerCase();
  if (!clean || clean === 'não possui' || clean === 'nao possui') return undefined;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(clean) ? clean : undefined;
};

/**
 * Converte saldo de pontos em número inteiro >= 0.
 */
export const normalizeImportPoints = (value: unknown): number => {
  if (typeof value === 'number') {
    return isNaN(value) || value < 0 ? 0 : Math.round(value);
  }
  const str = String(value || '0').replace(',', '.').trim();
  const parsed = Number(str);
  return isNaN(parsed) || parsed < 0 ? 0 : Math.round(parsed);
};

export interface SafeImportedClient {
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  loyalty_points: number;
}

export interface SpreadsheetValidationResult {
  valid: boolean;
  totalColumns: number;
  detectedColumns: string[];
  isAppBarberLayout: boolean;
  sensitiveColumnsDetected: string[];
  sensitiveColumnsPurged: string[];
  importedClients: SafeImportedClient[];
  invalidRowsCount: number;
  summaryMessage: string;
  securityNotice: string;
}

/**
 * Analisa e extrai os cabeçalhos de uma planilha Excel.
 */
export const extractSheetHeaders = (sheet: XLSX.WorkSheet): string[] => {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  const headers: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c += 1) {
    const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c });
    const cell = sheet[cellAddress];
    if (cell && cell.v !== undefined && cell.v !== null) {
      headers.push(String(cell.v).trim());
    }
  }
  return headers;
};

/**
 * Valida a planilha de clientes, filtra colunas sensíveis e normaliza os dados permitidos.
 */
export const parseAndValidateClientWorkbook = (
  workbook: XLSX.WorkBook
): SpreadsheetValidationResult => {
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('A planilha não possui abas disponíveis.');
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error('Não foi possível ler a aba da planilha.');
  }

  const detectedColumns = extractSheetHeaders(sheet);
  const normalizedHeaders = detectedColumns.map(normalizeImportHeader);

  // Identifica colunas sensíveis presentes no arquivo
  const sensitiveColumnsDetected = detectedColumns.filter((header) =>
    SENSITIVE_OR_DISCARDED_COLUMNS.includes(normalizeImportHeader(header) as any)
  );

  const isAppBarber = isAppBarber24ColumnLayout(detectedColumns);

  // Verifica se possui coluna essencial de identificação (Nome)
  const hasNameColumn = normalizedHeaders.some((h) => ['nome', 'nome completo', 'cliente'].includes(h));
  if (!hasNameColumn) {
    throw new Error('A planilha precisa conter a coluna "Nome" para cadastrar os clientes.');
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  const importedClients: SafeImportedClient[] = [];
  let invalidRowsCount = 0;

  rows.forEach((row) => {
    const rawName = readImportValue(row, ['Nome', 'Nome Completo', 'Cliente']);
    const name = rawName.replace(/\s+/g, ' ').trim();
    if (!name) {
      invalidRowsCount += 1;
      return;
    }

    const rawCelular = readImportValue(row, ['Celular', 'Celular 1', 'WhatsApp']);
    const rawTelefone = readImportValue(row, ['Telefone', 'Telefone Fixo']);
    const ddi = readImportValue(row, ['DDI']);
    const phone = formatDisplayPhone(rawCelular || rawTelefone, ddi);

    const rawEmail = readImportValue(row, ['Email', 'E-mail']);
    const email = normalizeImportEmail(rawEmail);

    const rawObs = readImportValue(row, ['Obs', 'Observações', 'Observacao', 'Notas']);
    const notes = rawObs && rawObs !== 'Não Possui' ? rawObs : undefined;

    const rawPoints = readImportValue(row, ['Pontos', 'Pontos Fidelidade', 'Saldo Pontos']);
    const loyalty_points = normalizeImportPoints(rawPoints);

    // Garante construção limpa: SEM CPF, RG, Endereço ou outros dados sensíveis
    importedClients.push({
      name,
      phone,
      email,
      notes,
      loyalty_points,
    });
  });

  if (importedClients.length === 0) {
    throw new Error('Nenhum cliente válido com nome preenchido foi encontrado na planilha.');
  }

  const totalCols = detectedColumns.length;
  const layoutLabel = isAppBarber
    ? `Layout AppBarber validado (${totalCols} colunas)`
    : `Planilha validada (${totalCols} colunas)`;

  const summaryMessage = `${layoutLabel}: ${importedClients.length} cliente${
    importedClients.length === 1 ? '' : 's'
  } pronto${importedClients.length === 1 ? '' : 's'} para importação segura.`;

  const securityNotice = sensitiveColumnsDetected.length > 0
    ? `Segurança ativa: ${sensitiveColumnsDetected.length} campos sensíveis/desnecessários (${sensitiveColumnsDetected.join(
        ', '
      )}) foram ignorados e não serão gravados.`
    : 'Nenhum dado sensível detectado.';

  return {
    valid: true,
    totalColumns: totalCols,
    detectedColumns,
    isAppBarberLayout: isAppBarber,
    sensitiveColumnsDetected,
    sensitiveColumnsPurged: sensitiveColumnsDetected,
    importedClients,
    invalidRowsCount,
    summaryMessage,
    securityNotice,
  };
};

export interface ApplyImportResult {
  nextClients: Client[];
  added: number;
  updated: number;
  total: number;
}

/**
 * Aplica os clientes importados sobre a base existente do AgendAI,
 * respeitando deduplicação por telefone (identidade principal) e por nome.
 */
export const applyClientsToCrm = (
  currentClients: Client[],
  incomingClients: SafeImportedClient[],
  orgId?: string
): ApplyImportResult => {
  let added = 0;
  let updated = 0;

  const base = dedupeClients(currentClients || []).map((client) => ({ ...client }));

  incomingClients.forEach((incoming) => {
    const phoneKey = normalizeClientPhone(incoming.phone);
    const nameKey = incoming.name.trim().toLocaleLowerCase('pt-BR');

    const index = base.findIndex((client) => {
      const currentPhone = normalizeClientPhone(client.phone);
      if (phoneKey && currentPhone) {
        return currentPhone === phoneKey;
      }
      return !currentPhone && client.name.trim().toLocaleLowerCase('pt-BR') === nameKey;
    });

    if (index >= 0) {
      const existing = base[index];
      base[index] = {
        ...existing,
        name: incoming.name || existing.name,
        phone: phoneKey ? incoming.phone : existing.phone,
        email: incoming.email || existing.email,
        notes: incoming.notes || existing.notes,
        loyalty_points: Math.max(Number(existing.loyalty_points || 0), incoming.loyalty_points),
        archived: false,
        archived_at: undefined,
      };
      updated += 1;
    } else {
      base.unshift({
        id: `cli-import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        org_id: orgId,
        name: incoming.name,
        phone: incoming.phone || 'Não informado',
        email: incoming.email,
        notes: incoming.notes,
        loyalty_points: incoming.loyalty_points,
        total_visits: 0,
        total_spent: 0,
        last_visit: 'Importado da planilha',
        archived: false,
      });
      added += 1;
    }
  });

  return {
    nextClients: dedupeClients(base),
    added,
    updated,
    total: incomingClients.length,
  };
};
