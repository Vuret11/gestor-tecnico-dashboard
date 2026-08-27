import {
  Document, Page, Text, View, StyleSheet, PDFDownloadLink,
} from '@react-pdf/renderer';
import { FileText } from 'lucide-react';

const B = '#e7332f';
const S9 = '#0f172a';
const S7 = '#334155';
const S5 = '#64748b';
const S1 = '#f1f5f9';

const s = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', fontSize: 9, color: S7 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: B },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: S9 },
  subtitle: { fontSize: 9, color: S5, marginTop: 3 },
  badge: { backgroundColor: B, color: '#fff', fontSize: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kpi: { flex: 1, backgroundColor: S1, borderRadius: 6, padding: 10 },
  kpiVal: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: S9 },
  kpiLabel: { fontSize: 7, color: S5, marginTop: 2 },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: S5, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginTop: 14 },
  table: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  thead: { flexDirection: 'row', backgroundColor: S1, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  th: { flex: 1, paddingHorizontal: 6, paddingVertical: 5, fontSize: 7, fontFamily: 'Helvetica-Bold', color: S5 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  trAlt: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fafafa' },
  trTotal: { flexDirection: 'row', backgroundColor: S1, borderTopWidth: 2, borderTopColor: '#cbd5e1' },
  td: { flex: 1, paddingHorizontal: 6, paddingVertical: 4, fontSize: 8, color: S7 },
  tdBold: { flex: 1, paddingHorizontal: 6, paddingVertical: 4, fontSize: 8, fontFamily: 'Helvetica-Bold', color: S9 },
  footer: { position: 'absolute', bottom: 24, left: 36, right: 36, textAlign: 'center', fontSize: 7, color: '#94a3b8' },
});

type Fila = Record<string, string | number>;

interface Props {
  titulo: string;
  subtitulo: string;
  tipoLabel: string;
  filas: Fila[];
  kpis: { label: string; value: string | number; sub?: string }[];
  tecnicoFilas?: Fila[];
}

function AuditoriaPDFDoc({ titulo, subtitulo, tipoLabel, filas, kpis, tecnicoFilas }: Props) {
  const cols = filas.length > 0 ? Object.keys(filas[0]) : [];
  const totales: Record<string, number> = {};
  cols.forEach(c => {
    if (c !== 'Período') totales[c] = filas.reduce((sum, f) => sum + (Number(f[c]) || 0), 0);
  });

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Cabecera */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Auditoría — {titulo}</Text>
            <Text style={s.subtitle}>{subtitulo}</Text>
          </View>
          <Text style={s.badge}>{tipoLabel}</Text>
        </View>

        {/* KPIs */}
        <View style={s.kpiRow}>
          {kpis.map(k => (
            <View key={k.label} style={s.kpi}>
              <Text style={s.kpiVal}>{k.value}</Text>
              <Text style={s.kpiLabel}>{k.label}</Text>
              {k.sub && <Text style={{ ...s.kpiLabel, marginTop: 1 }}>{k.sub}</Text>}
            </View>
          ))}
        </View>

        {/* Tabla */}
        <Text style={s.sectionTitle}>Desglose por período</Text>
        <View style={s.table}>
          <View style={s.thead}>
            {cols.map(c => <Text key={c} style={s.th}>{c}</Text>)}
          </View>
          {filas.map((f, i) => (
            <View key={i} style={i % 2 === 0 ? s.tr : s.trAlt}>
              {cols.map(c => (
                <Text key={c} style={c === 'Período' ? s.tdBold : s.td}>
                  {f[c] === 0 ? '—' : String(f[c])}
                </Text>
              ))}
            </View>
          ))}
          {/* Fila total */}
          <View style={s.trTotal}>
            {cols.map(c => (
              <Text key={c} style={{ ...s.tdBold, fontSize: 9 }}>
                {c === 'Período' ? 'TOTAL' : (totales[c] || '—')}
              </Text>
            ))}
          </View>
        </View>

        {/* Técnicos */}
        {tecnicoFilas && tecnicoFilas.length > 0 && (() => {
          const tCols = Object.keys(tecnicoFilas[0]);
          return (
            <View>
              <Text style={{ ...s.sectionTitle, marginTop: 20 }}>Rendimiento por técnico</Text>
              <View style={s.table}>
                <View style={s.thead}>
                  {tCols.map(c => <Text key={c} style={s.th}>{c}</Text>)}
                </View>
                {tecnicoFilas.map((f, i) => (
                  <View key={i} style={i % 2 === 0 ? s.tr : s.trAlt}>
                    {tCols.map(c => (
                      <Text key={c} style={c === 'Técnico' ? s.tdBold : s.td}>
                        {f[c] === 0 ? '—' : String(f[c])}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          );
        })()}

        <Text style={s.footer}>
          Documento generado el {new Date().toLocaleDateString('es-ES')} · Gestor Técnico HomeServe Solar
        </Text>
      </Page>
    </Document>
  );
}

export function AuditoriaPDFButton(props: Props) {
  return (
    <PDFDownloadLink
      document={<AuditoriaPDFDoc {...props} />}
      fileName={`auditoria_${props.titulo.replace(/\s+/g, '_')}.pdf`}
    >
      {({ loading }) => (
        <button
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-60"
          disabled={loading}
        >
          <FileText size={15} />
          {loading ? 'Generando...' : 'PDF'}
        </button>
      )}
    </PDFDownloadLink>
  );
}
