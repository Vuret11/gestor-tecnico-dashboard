import {
  Document, Page, Text, View, StyleSheet, PDFDownloadLink, Image,
} from '@react-pdf/renderer';
import type { Informe, TipoVisita, Foto, VisitaChecklist } from '../types';
import { Download } from 'lucide-react';
import { LOGO_BASE64 } from '../assets/logo-base64';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3000';
const fotoSrc = (url: string) =>
  url.startsWith('http') || url.startsWith('data:') ? url : `${API_BASE}${url}`;

// ── Paleta ────────────────────────────────────────────────────────────────────
const BRAND      = '#e7332f';
const SLATE_900  = '#0f172a';
const SLATE_700  = '#334155';
const SLATE_500  = '#64748b';
const SLATE_400  = '#94a3b8';
const SLATE_300  = '#cbd5e1';
const SLATE_100  = '#f1f5f9';
const SLATE_50   = '#f8fafc';
const AMBER_700  = '#b45309';
const AMBER_50   = '#fffbeb';
const BLUE_700   = '#1d4ed8';
const BLUE_50    = '#eff6ff';
const GREEN_600  = '#16a34a';

const TIPO_LABELS: Record<TipoVisita, string> = {
  visita_tecnica_fv: 'Visita Técnica Fotovoltaica',
  visita_tecnica_aerotermia: 'Visita Técnica Aerotermia',
  instalacion_nueva_fv: 'Instalación Nueva Fotovoltaica',
  instalacion_nueva_aerotermia: 'Instalación Nueva Aerotermia',
};

// ── Estilos ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    paddingTop: 0, paddingBottom: 48, paddingHorizontal: 0,
    fontFamily: 'Helvetica', fontSize: 10, color: SLATE_700,
    backgroundColor: '#ffffff',
  },

  // Cabecera
  header: {
    backgroundColor: BRAND, paddingHorizontal: 40, paddingVertical: 28,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  headerLeft: { flexDirection: 'column', gap: 6, justifyContent: 'center' },
  headerLogo: { height: 52, width: 'auto' },
  headerSub: { fontSize: 8, color: 'rgba(255,255,255,0.75)', letterSpacing: 1.5, textTransform: 'uppercase' },
  headerRight: { alignItems: 'flex-end', gap: 2 },
  headerDocTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: 'rgba(255,255,255,0.9)', letterSpacing: 1, textTransform: 'uppercase' },
  headerRef: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  headerDate: { fontSize: 8, color: 'rgba(255,255,255,0.7)' },

  // Banda de tipo
  tipoBand: {
    paddingHorizontal: 40, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderBottomWidth: 1, borderBottomColor: SLATE_300,
  },
  tipoDot: { width: 6, height: 6, borderRadius: 3 },
  tipoText: { fontSize: 10, fontFamily: 'Helvetica-Bold' },

  body: { paddingHorizontal: 40, paddingTop: 24 },

  // Cards
  row: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  card: { flex: 1, backgroundColor: SLATE_50, borderRadius: 6, padding: 14, borderWidth: 1, borderColor: SLATE_300 },
  cardLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: SLATE_500, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  cardTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: SLATE_900, marginBottom: 2 },
  cardSub: { fontSize: 9, color: SLATE_500, marginBottom: 1 },

  // Secciones
  section: { marginBottom: 16 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: SLATE_300,
  },
  sectionDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: BRAND },
  sectionTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: SLATE_500, textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionBody: { fontSize: 10, color: SLATE_700, lineHeight: 1.5, paddingLeft: 10 },

  // Duración
  durRow: {
    flexDirection: 'row', gap: 10, marginBottom: 16,
  },
  durCard: {
    flex: 1, backgroundColor: SLATE_100, borderRadius: 6, padding: 10,
  },
  durLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: SLATE_500, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  durValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: SLATE_900 },

  // Checklist
  clSeccion: { marginBottom: 10 },
  clSeccionTitulo: {
    fontSize: 8, fontFamily: 'Helvetica-Bold', color: SLATE_400,
    textTransform: 'uppercase', letterSpacing: 0.8,
    borderBottomWidth: 1, borderBottomColor: SLATE_300,
    paddingBottom: 3, marginBottom: 6,
  },
  clGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  clItem: { width: '50%', paddingRight: 8, marginBottom: 6 },
  clItemLabel: { fontSize: 8, color: SLATE_400, marginBottom: 1 },
  clItemValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: SLATE_700 },
  clFirmado: { fontSize: 8, color: SLATE_500, marginTop: 6, fontFamily: 'Helvetica-Oblique' },

  // Fotos
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  photoItem: { width: '31%', height: 90, borderRadius: 4, backgroundColor: SLATE_100 },

  // Firmas
  signaturesRow: {
    flexDirection: 'row', gap: 20, marginTop: 24,
    paddingTop: 16, borderTopWidth: 1, borderTopColor: SLATE_300,
  },
  signatureBox: { flex: 1 },
  signatureLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: SLATE_500, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  signatureImg: { height: 50, objectFit: 'contain', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: SLATE_300 },
  signatureLine: { borderTopWidth: 1, borderTopColor: SLATE_300, paddingTop: 4 },
  signatureName: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: SLATE_700 },
  signedBadge: { fontSize: 8, color: GREEN_600, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  signatureBlank: { height: 50, borderBottomWidth: 1, borderBottomColor: SLATE_300, marginBottom: 6 },

  // Pie de página
  footer: {
    position: 'absolute', bottom: 16, left: 40, right: 40,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: SLATE_300, paddingTop: 8,
  },
  footerText: { fontSize: 7, color: SLATE_500 },
  footerBrand: { fontSize: 7, color: BRAND, fontFamily: 'Helvetica-Bold' },
});

// ── PDF Document ──────────────────────────────────────────────────────────────
function InformePDFDoc({
  inf, fotos = [], checklist,
}: {
  inf: Informe;
  fotos?: Foto[];
  checklist?: VisitaChecklist | null;
}) {
  const visita = inf.visita;
  const tipo = (visita?.tipo as TipoVisita) || 'visita_tecnica_fv';
  const esInstalacion = tipo.startsWith('instalacion_nueva');
  const tipoColor = esInstalacion ? AMBER_700 : BLUE_700;
  const tipoBg   = esInstalacion ? AMBER_50  : BLUE_50;
  const tipoLabel = TIPO_LABELS[tipo] ?? tipo;
  const ref = `INF-${inf.id.substring(0, 8).toUpperCase()}`;

  const fecha = new Date(inf.createdAt).toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const fechaVisita = visita?.fechaProgramada
    ? new Date(visita.fechaProgramada).toLocaleString('es-ES', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—';

  // Duración real
  const fmtFecha = (iso: string) => new Date(iso).toLocaleString('es-ES', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
  const durMins = visita?.fechaInicio && visita?.fechaFin
    ? Math.round((new Date(visita.fechaFin).getTime() - new Date(visita.fechaInicio).getTime()) / 60000)
    : null;
  const durStr = durMins !== null
    ? (durMins >= 60 ? `${Math.floor(durMins / 60)}h ${durMins % 60}min` : `${durMins} min`)
    : null;

  // Tiempo empleado (manual)
  const tiempoStr = inf.tiempoEmpleado
    ? inf.tiempoEmpleado >= 60
      ? `${Math.floor(inf.tiempoEmpleado / 60)}h ${inf.tiempoEmpleado % 60}min`
      : `${inf.tiempoEmpleado} minutos`
    : null;

  const hayDuracion = visita?.fechaInicio || visita?.fechaFin || tiempoStr;
  const hayChecklist = checklist?.id && checklist.plantilla;
  const hayFotos = fotos.length > 0;

  return (
    <Document title={`Informe ${ref}`} author="HomeServe Solar" subject="Informe de visita técnica">
      <Page size="A4" style={s.page}>

        {/* Cabecera */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Image src={LOGO_BASE64} style={s.headerLogo} />
            <Text style={s.headerSub}>Informe de Visita Técnica</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerDocTitle}>Referencia</Text>
            <Text style={s.headerRef}>{ref}</Text>
            <Text style={s.headerDate}>{fecha}</Text>
          </View>
        </View>

        {/* Banda tipo */}
        <View style={[s.tipoBand, { backgroundColor: tipoBg }]}>
          <View style={[s.tipoDot, { backgroundColor: tipoColor }]} />
          <Text style={[s.tipoText, { color: tipoColor }]}>{tipoLabel}</Text>
        </View>

        {/* Cuerpo */}
        <View style={s.body}>

          {/* Instalación + técnico */}
          <View style={s.row}>
            <View style={s.card}>
              <Text style={s.cardLabel}>Instalación</Text>
              <Text style={s.cardTitle}>{visita?.instalacion?.nombre ?? '—'}</Text>
              <Text style={s.cardSub}>{visita?.instalacion?.cliente}</Text>
              <Text style={s.cardSub}>{visita?.instalacion?.direccion}</Text>
              <Text style={s.cardSub}>{visita?.instalacion?.ciudad}</Text>
              {visita?.instalacion?.telefono && (
                <Text style={s.cardSub}>{visita.instalacion.telefono}</Text>
              )}
            </View>
            <View style={s.card}>
              <Text style={s.cardLabel}>Técnico responsable</Text>
              <Text style={s.cardTitle}>{visita?.tecnico?.nombre ?? '—'}</Text>
              <Text style={s.cardSub}>{visita?.tecnico?.email}</Text>
              <Text style={[s.cardLabel, { marginTop: 10 }]}>Fecha de visita</Text>
              <Text style={[s.cardTitle, { fontSize: 9 }]}>{fechaVisita}</Text>
            </View>
          </View>

          {/* Descripción */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <View style={s.sectionDot} />
              <Text style={s.sectionTitle}>Descripción del trabajo</Text>
            </View>
            <Text style={s.sectionBody}>{inf.descripcion}</Text>
          </View>

          {/* Trabajos realizados */}
          {inf.trabajosRealizados && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <View style={s.sectionDot} />
                <Text style={s.sectionTitle}>Trabajos realizados</Text>
              </View>
              <Text style={s.sectionBody}>{inf.trabajosRealizados}</Text>
            </View>
          )}

          {/* Materiales */}
          {inf.materialesUsados && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <View style={s.sectionDot} />
                <Text style={s.sectionTitle}>Materiales utilizados</Text>
              </View>
              <Text style={s.sectionBody}>{inf.materialesUsados}</Text>
            </View>
          )}

          {/* Notas */}
          {visita?.notas && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <View style={s.sectionDot} />
                <Text style={s.sectionTitle}>Notas adicionales</Text>
              </View>
              <Text style={[s.sectionBody, { fontFamily: 'Helvetica-Oblique' }]}>{visita.notas}</Text>
            </View>
          )}

          {/* Duración real */}
          {hayDuracion && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <View style={s.sectionDot} />
                <Text style={s.sectionTitle}>Tiempos</Text>
              </View>
              <View style={s.durRow}>
                {visita?.fechaInicio && (
                  <View style={s.durCard}>
                    <Text style={s.durLabel}>Inicio</Text>
                    <Text style={s.durValue}>{fmtFecha(visita.fechaInicio)}</Text>
                  </View>
                )}
                {visita?.fechaFin && (
                  <View style={s.durCard}>
                    <Text style={s.durLabel}>Fin</Text>
                    <Text style={s.durValue}>{fmtFecha(visita.fechaFin)}</Text>
                  </View>
                )}
                {(durStr || tiempoStr) && (
                  <View style={s.durCard}>
                    <Text style={s.durLabel}>Duración</Text>
                    <Text style={s.durValue}>{durStr ?? tiempoStr}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Checklist */}
          {hayChecklist && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <View style={s.sectionDot} />
                <Text style={s.sectionTitle}>Checklist: {checklist!.plantilla!.nombre}</Text>
              </View>
              {[...checklist!.plantilla!.secciones]
                .sort((a, b) => a.orden - b.orden)
                .map(sec => (
                  <View key={sec.id} style={s.clSeccion}>
                    <Text style={s.clSeccionTitulo}>{sec.titulo}</Text>
                    <View style={s.clGrid}>
                      {[...sec.items].sort((a, b) => a.orden - b.orden).map(item => {
                        const resp = checklist!.respuestas?.find(r => r.itemId === item.id);
                        const valor = resp?.valor ?? '—';
                        const display = item.tipo === 'boolean'
                          ? (valor === 'true' ? '✓ Sí' : '✗ No')
                          : `${valor}${item.unidad ? ` ${item.unidad}` : ''}`;
                        return (
                          <View key={item.id} style={s.clItem}>
                            <Text style={s.clItemLabel}>{item.etiqueta}</Text>
                            <Text style={s.clItemValue}>{display}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))}
              {checklist!.completadoEn && (
                <Text style={s.clFirmado}>
                  Completado el {fmtFecha(checklist!.completadoEn)}
                  {checklist!.firmante ? ` · Firmado por ${checklist!.firmante}` : ''}
                </Text>
              )}
            </View>
          )}

          {/* Fotografías */}
          {hayFotos && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <View style={s.sectionDot} />
                <Text style={s.sectionTitle}>Fotografías ({fotos.length})</Text>
              </View>
              <View style={s.photoGrid}>
                {fotos.map((foto, i) => (
                  <Image key={i} src={fotoSrc(foto.url)} style={s.photoItem} />
                ))}
              </View>
            </View>
          )}

          {/* Firmas */}
          <View style={s.signaturesRow}>
            <View style={s.signatureBox}>
              <Text style={s.signatureLabel}>Firma del técnico</Text>
              <View style={s.signatureBlank} />
              <View style={s.signatureLine}>
                <Text style={s.signatureName}>{visita?.tecnico?.nombre ?? '—'}</Text>
              </View>
            </View>
            <View style={s.signatureBox}>
              <Text style={s.signatureLabel}>Firma del cliente</Text>
              {inf.firmaClienteUrl
                ? <Image src={inf.firmaClienteUrl} style={s.signatureImg} />
                : <View style={s.signatureBlank} />}
              {inf.nombreFirmante && (
                <Text style={[s.signedBadge, { marginBottom: 2 }]}>✓ Firmado</Text>
              )}
              <View style={s.signatureLine}>
                <Text style={s.signatureName}>{inf.nombreFirmante || '—'}</Text>
              </View>
            </View>
          </View>

        </View>

        {/* Pie */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            Generado el {new Date().toLocaleDateString('es-ES')} · Gestor Técnico
          </Text>
          <Text style={s.footerBrand}>HomeServe Solar</Text>
        </View>

      </Page>
    </Document>
  );
}

// ── Botón ─────────────────────────────────────────────────────────────────────
export function InformePDFButton({
  inf,
  fotos,
  checklist,
  compact = false,
}: {
  inf: Informe;
  fotos?: Foto[];
  checklist?: VisitaChecklist | null;
  compact?: boolean;
}) {
  const ref = `INF-${inf.id.substring(0, 8).toUpperCase()}`;
  const filename = `${ref}-${(inf.visita?.instalacion?.nombre ?? 'informe').replace(/\s+/g, '-')}.pdf`;
  const doc = <InformePDFDoc inf={inf} fotos={fotos} checklist={checklist} />;

  if (compact) {
    return (
      <PDFDownloadLink document={doc} fileName={filename}
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand border border-slate-300 hover:border-brand px-2 py-1 rounded transition-colors"
      >
        {({ loading }) => <><Download size={11} />{loading ? '…' : 'PDF'}</>}
      </PDFDownloadLink>
    );
  }

  return (
    <PDFDownloadLink document={doc} fileName={filename}
      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors"
    >
      {({ loading }) => <><Download size={14} />{loading ? 'Generando...' : 'Descargar PDF'}</>}
    </PDFDownloadLink>
  );
}
