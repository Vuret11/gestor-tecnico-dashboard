import {
  Document, Page, Text, View, StyleSheet, PDFDownloadLink, Image,
} from '@react-pdf/renderer';
import type { Informe, TipoVisita } from '../types';
import { Download } from 'lucide-react';
import { LOGO_BASE64 } from '../assets/logo-base64';

// ── Estilos ──────────────────────────────────────────────────────────────────

const BRAND = '#e7332f';
const BRAND_LIGHT = '#fdf2f2';
const SLATE_900 = '#0f172a';
const SLATE_700 = '#334155';
const SLATE_500 = '#64748b';
const SLATE_300 = '#cbd5e1';
const SLATE_100 = '#f1f5f9';
const SLATE_50 = '#f8fafc';
const AMBER_700 = '#b45309';
const AMBER_50 = '#fffbeb';
const BLUE_700 = '#1d4ed8';
const BLUE_50 = '#eff6ff';
const GREEN_600 = '#16a34a';
const GREEN_50 = '#f0fdf4';

const TIPO_LABELS: Record<TipoVisita, string> = {
  visita_tecnica_fv: 'Visita Técnica Fotovoltaica',
  visita_tecnica_aerotermia: 'Visita Técnica Aerotermia',
  instalacion_nueva_fv: 'Instalación Nueva Fotovoltaica',
  instalacion_nueva_aerotermia: 'Instalación Nueva Aerotermia',
};

const s = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 40,
    paddingHorizontal: 0,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: SLATE_700,
    backgroundColor: '#ffffff',
  },

  // ── Cabecera de marca ──
  header: {
    backgroundColor: BRAND,
    paddingHorizontal: 40,
    paddingVertical: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerLeft: {
    flexDirection: 'column',
    gap: 6,
    justifyContent: 'center',
  },
  headerLogo: {
    height: 52,
    width: 'auto',
  },
  headerSub: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  headerDocTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerRef: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  headerDate: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.7)',
  },

  // ── Banda de tipo ──
  tipoBand: {
    paddingHorizontal: 40,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: SLATE_300,
  },
  tipoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tipoText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },

  // ── Cuerpo del documento ──
  body: {
    paddingHorizontal: 40,
    paddingTop: 24,
  },

  // ── Grid de tarjetas ──
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  card: {
    flex: 1,
    backgroundColor: SLATE_50,
    borderRadius: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: SLATE_300,
  },
  cardLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: SLATE_500,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: SLATE_900,
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 9,
    color: SLATE_500,
    marginBottom: 1,
  },

  // ── Secciones ──
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: SLATE_300,
  },
  sectionDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: BRAND,
  },
  sectionTitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: SLATE_500,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionBody: {
    fontSize: 10,
    color: SLATE_700,
    lineHeight: 1.5,
    paddingLeft: 10,
  },

  // ── Tiempo empleado ──
  tiempoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SLATE_100,
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
  },
  tiempoLabel: {
    fontSize: 8,
    color: SLATE_500,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: 'Helvetica-Bold',
  },
  tiempoValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: SLATE_900,
  },

  // ── Firmas ──
  signaturesRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: SLATE_300,
  },
  signatureBox: {
    flex: 1,
  },
  signatureLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: SLATE_500,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 40,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: SLATE_300,
    paddingTop: 4,
  },
  signatureName: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: SLATE_700,
  },
  signedBadge: {
    fontSize: 8,
    color: GREEN_600,
    fontFamily: 'Helvetica-Bold',
  },

  // ── Pie de página ──
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: SLATE_300,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: SLATE_500,
  },
  footerBrand: {
    fontSize: 7,
    color: BRAND,
    fontFamily: 'Helvetica-Bold',
  },
});

// ── PDF Document component ────────────────────────────────────────────────────

function InformePDFDoc({ inf }: { inf: Informe }) {
  const visita = inf.visita;
  const tipo = (visita?.tipo as TipoVisita) || 'visita_tecnica_fv';
  const esInstalacion = tipo.startsWith('instalacion_nueva');
  const tipoColor = esInstalacion ? AMBER_700 : BLUE_700;
  const tipoBg = esInstalacion ? AMBER_50 : BLUE_50;
  const tipoLabel = TIPO_LABELS[tipo] ?? tipo;
  const ref = `INF-${inf.id.substring(0, 8).toUpperCase()}`;
  const fecha = new Date(inf.createdAt).toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const fechaVisita = visita?.fechaProgramada
    ? new Date(visita.fechaProgramada).toLocaleString('es-ES', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';

  const tiempoStr = inf.tiempoEmpleado
    ? inf.tiempoEmpleado >= 60
      ? `${Math.floor(inf.tiempoEmpleado / 60)}h ${inf.tiempoEmpleado % 60}min`
      : `${inf.tiempoEmpleado} minutos`
    : null;

  return (
    <Document
      title={`Informe ${ref}`}
      author="HomeServe Solar"
      subject="Informe de visita técnica"
    >
      <Page size="A4" style={s.page}>

        {/* Cabecera de marca */}
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

        {/* Banda de tipo */}
        <View style={[s.tipoBand, { backgroundColor: tipoBg }]}>
          <View style={[s.tipoDot, { backgroundColor: tipoColor }]} />
          <Text style={[s.tipoText, { color: tipoColor }]}>{tipoLabel}</Text>
        </View>

        {/* Cuerpo */}
        <View style={s.body}>

          {/* Cards instalación + técnico */}
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

          {/* Tiempo empleado */}
          {tiempoStr && (
            <View style={s.tiempoRow}>
              <View>
                <Text style={s.tiempoLabel}>Tiempo empleado</Text>
                <Text style={s.tiempoValue}>{tiempoStr}</Text>
              </View>
            </View>
          )}

          {/* Notas */}
          {visita?.notas && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <View style={s.sectionDot} />
                <Text style={s.sectionTitle}>Notas adicionales</Text>
              </View>
              <Text style={[s.sectionBody, { fontFamily: 'Helvetica-Oblique' }]}>
                {visita.notas}
              </Text>
            </View>
          )}

          {/* Firmas */}
          <View style={s.signaturesRow}>
            <View style={s.signatureBox}>
              <Text style={s.signatureLabel}>Firma del técnico</Text>
              <View style={s.signatureLine}>
                <Text style={s.signatureName}>{visita?.tecnico?.nombre ?? '—'}</Text>
              </View>
            </View>
            <View style={s.signatureBox}>
              <Text style={s.signatureLabel}>Firma del cliente</Text>
              {inf.nombreFirmante && (
                <Text style={s.signedBadge}>✓ Documento firmado</Text>
              )}
              <View style={[s.signatureLine, { marginTop: inf.nombreFirmante ? 4 : 0 }]}>
                <Text style={s.signatureName}>{inf.nombreFirmante || '—'}</Text>
              </View>
            </View>
          </View>

        </View>

        {/* Pie de página */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            Documento generado el {new Date().toLocaleDateString('es-ES')} · Gestor Técnico
          </Text>
          <Text style={s.footerBrand}>HomeServe Solar</Text>
        </View>

      </Page>
    </Document>
  );
}

// ── Botón de descarga ─────────────────────────────────────────────────────────

export function InformePDFButton({ inf, compact = false }: { inf: Informe; compact?: boolean }) {
  const ref = `INF-${inf.id.substring(0, 8).toUpperCase()}`;
  const filename = `${ref}-${(inf.visita?.instalacion?.nombre ?? 'informe').replace(/\s+/g, '-')}.pdf`;

  if (compact) {
    return (
      <PDFDownloadLink
        document={<InformePDFDoc inf={inf} />}
        fileName={filename}
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand border border-slate-300 hover:border-brand px-2 py-1 rounded transition-colors"
      >
        {({ loading }) => (
          <>
            <Download size={11} />
            {loading ? '…' : 'PDF'}
          </>
        )}
      </PDFDownloadLink>
    );
  }

  return (
    <PDFDownloadLink
      document={<InformePDFDoc inf={inf} />}
      fileName={filename}
      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors"
    >
      {({ loading }) => (
        <>
          <Download size={14} />
          {loading ? 'Generando...' : 'Descargar PDF'}
        </>
      )}
    </PDFDownloadLink>
  );
}
