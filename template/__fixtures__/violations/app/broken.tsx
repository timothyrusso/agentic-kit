import { View } from 'react-native';
import { HighPage } from '@/features/high/ui/HighPage';

/** enforce-index-boundary-features-high (high's ui/) and arch/no-literal-gutter (a literal edge). */
export default function BrokenRoute() {
  return (
    <View style={{ paddingHorizontal: 16 }}>
      <HighPage />
    </View>
  );
}
