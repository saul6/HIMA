// Lista de verificación con marcas: casilla vacía o casilla navy con palomita vectorial.
import { View, Text, Svg, Path } from '@react-pdf/renderer'
import { PC } from '@/lib/pdf/components/tokens'

export function Checklist({ items }: { items: { label: string; checked: boolean }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingTop: 2, paddingBottom: 6 }}>
      {items.map((item) => (
        <View key={item.label} wrap={false} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 4 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              borderWidth: 0.75,
              borderColor: item.checked ? PC.m13Navy : PC.footerGray,
              backgroundColor: item.checked ? PC.m13Navy : PC.white,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {item.checked && (
              <Svg viewBox="0 0 10 10" width={8} height={8}>
                <Path d="M2 5.2 L4.2 7.4 L8 2.8" stroke={PC.white} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            )}
          </View>
          <Text style={{ fontSize: 8, color: PC.fieldValue, marginLeft: 4 }}>{item.label}</Text>
        </View>
      ))}
    </View>
  )
}
