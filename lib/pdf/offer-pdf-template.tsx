import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import type { Offer } from '@/types/offer'

// Register Hebrew font (you'll need to add a Hebrew font file)
// Font.register({
//   family: 'Heebo',
//   src: '/fonts/Heebo-Regular.ttf',
// })

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    direction: 'rtl',
  },
  header: {
    marginBottom: 30,
    borderBottom: '2 solid #2563eb',
    paddingBottom: 15,
  },
  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 5,
    textAlign: 'right',
  },
  companyInfo: {
    fontSize: 10,
    color: '#666',
    textAlign: 'right',
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
    color: '#1e293b',
  },
  section: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 5,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1e293b',
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    textAlign: 'right',
  },
  label: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'right',
  },
  value: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'right',
  },
  priceSection: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#eff6ff',
    borderRadius: 5,
    border: '1 solid #2563eb',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    textAlign: 'right',
  },
  priceLabel: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'right',
  },
  priceValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTop: '2 solid #2563eb',
    textAlign: 'right',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'right',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#16a34a',
    textAlign: 'right',
  },
  termsSection: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#fef3c7',
    borderRadius: 5,
  },
  termsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#92400e',
    textAlign: 'right',
  },
  termItem: {
    fontSize: 10,
    marginBottom: 4,
    color: '#78350f',
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: '1 solid #cbd5e1',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 9,
    color: '#64748b',
    textAlign: 'center',
  },
})

interface OfferPdfTemplateProps {
  offer: Offer
}

export const OfferPdfTemplate: React.FC<OfferPdfTemplateProps> = ({ offer }) => {
  const formatPrice = (price: number) => {
    return `₪${price.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>Pashkovsky Group</Text>
          <Text style={styles.companyInfo}>פתרונות אלומיניום מתקדמים</Text>
          <Text style={styles.companyInfo}>טלפון: 050-123-4567 | אימייל: info@pashkovsky-group.com</Text>
          <Text style={styles.companyInfo}>כתובת: רחוב הרצל 10, תל אביב</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>הצעת מחיר</Text>

        {/* Client Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>פרטי לקוח</Text>
          <View style={styles.row}>
            <Text style={styles.label}>שם הלקוח:</Text>
            <Text style={styles.value}>{offer.customerName}</Text>
          </View>
          {offer.customerPhone && (
            <View style={styles.row}>
              <Text style={styles.label}>טלפון:</Text>
              <Text style={styles.value}>{offer.customerPhone}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>תאריך הצעה:</Text>
            <Text style={styles.value}>{formatDate(offer.createdAt)}</Text>
          </View>
        </View>

        {/* Pergola Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>פרטי פרגולה</Text>
          <View style={styles.row}>
            <Text style={styles.label}>רוחב:</Text>
            <Text style={styles.value}>{offer.pergola.width} מטר</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>אורך:</Text>
            <Text style={styles.value}>{offer.pergola.length} מטר</Text>
          </View>
          {offer.pergola.height && (
            <View style={styles.row}>
              <Text style={styles.label}>גובה:</Text>
              <Text style={styles.value}>{offer.pergola.height} מטר</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>שטח כולל:</Text>
            <Text style={styles.value}>{offer.area} מ״ר</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>חומר:</Text>
            <Text style={styles.value}>אלומיניום פרימיום</Text>
          </View>
        </View>

        {/* Santaf (if enabled) */}
        {offer.santaf?.enabled && (
          <View style={styles.section}>
          <Text style={styles.sectionTitle}>סנטף BH</Text>
            <View style={styles.row}>
              <Text style={styles.label}>סוג:</Text>
              <Text style={styles.value}>
                {offer.santaf.withStructure ? 'סנטף BH עם קונסטרוקציה' : 'סנטף BH בסיסי'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>מחיר:</Text>
              <Text style={styles.value}>{formatPrice(offer.santafTotal)}</Text>
            </View>
          </View>
        )}

        {/* Pricing */}
        <View style={styles.priceSection}>
          <Text style={styles.sectionTitle}>פירוט מחירים</Text>
          
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>פרגולה ({offer.area} מ״ר × {formatPrice(offer.pergola.pricePerSqm)}):</Text>
            <Text style={styles.priceValue}>{formatPrice(offer.pergolaTotal)}</Text>
          </View>

          {offer.santaf?.enabled && (
            <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>סנטף BH:</Text>
              <Text style={styles.priceValue}>{formatPrice(offer.santafTotal)}</Text>
            </View>
          )}

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>סה״כ לפני מע״מ:</Text>
            <Text style={styles.priceValue}>{formatPrice(offer.totalBeforeVat)}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>מע״מ (18%):</Text>
            <Text style={styles.priceValue}>+{formatPrice(offer.vatAmount)}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>מחיר אחרי מע״מ:</Text>
            <Text style={styles.priceValue}>{formatPrice(offer.priceWithVat)}</Text>
          </View>

          {offer.discountPercent > 0 && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>הנחה ({offer.discountPercent}%):</Text>
              <Text style={styles.priceValue}>-{formatPrice(offer.discountAmount)}</Text>
            </View>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>מחיר סופי:</Text>
            <Text style={styles.totalValue}>{formatPrice(offer.finalPrice)}</Text>
          </View>
        </View>

        {/* Payment Terms */}
        <View style={styles.termsSection}>
          <Text style={styles.termsTitle}>תנאי תשלום</Text>
          <Text style={styles.termItem}>• מקדמה של 30% עם חתימת ההסכם</Text>
          <Text style={styles.termItem}>• 40% עם הזמנת החומרים</Text>
          <Text style={styles.termItem}>• 30% יתרה עם סיום ההתקנה</Text>
          <Text style={styles.termItem}>• תוקף ההצעה: 30 יום מתאריך ההצעה</Text>
        </View>

        {/* Warranty */}
        <View style={styles.termsSection}>
          <Text style={styles.termsTitle}>אחריות</Text>
          <Text style={styles.termItem}>• אחריות של 5 שנים על קונסטרוקציית האלומיניום</Text>
          <Text style={styles.termItem}>• אחריות של שנתיים על מערכות חשמליות (אם קיימות)</Text>
          <Text style={styles.termItem}>• שירות לקוחות זמין 24/7</Text>
          <Text style={styles.termItem}>• תחזוקה שנתית מומלצת (לא כלולה במחיר)</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Pashkovsky Group | רחוב הרצל 10, תל אביב | טלפון: 050-123-4567 | www.pashkovsky-group.com
          </Text>
          <Text style={styles.footerText}>
            ח.פ: 123456789 | אישור עוסק מורשה: 987654321
          </Text>
        </View>
      </Page>
    </Document>
  )
}

