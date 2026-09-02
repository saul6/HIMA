import { View, Text } from '@react-pdf/renderer'
import { PC } from './tokens'

interface ChecklistItem {
  label: string
  checked: boolean
}

interface PdfChecklistProps {
  items: ChecklistItem[]
}

export function PdfChecklist({ items }: PdfChecklistProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingTop: 6,
        paddingBottom: 6,
      }}
    >
      {items.map((item) => (
        <View
          key={item.label}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginRight: 16,
            marginBottom: 4,
          }}
        >
          {/* Badge cuadrado */}
          <View
            style={{
              width: 10,
              height: 10,
              backgroundColor: item.checked ? PC.section : PC.white,
              borderRadius: 2,
              borderWidth: item.checked ? 0 : 1,
              borderColor: PC.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {item.checked && (
              <Text
                style={{
                  color: PC.white,
                  fontSize: 7,
                  fontFamily: 'Helvetica-Bold',
                  lineHeight: 1,
                }}
              >
                v
              </Text>
            )}
          </View>
          {/* Label */}
          <Text style={{ fontSize: 8, color: PC.fieldValue, marginLeft: 4 }}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  )
}
