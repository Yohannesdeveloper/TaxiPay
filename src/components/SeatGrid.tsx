import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Seat } from '../types';
import { SeatCard } from './SeatCard';

interface SeatGridProps {
  seats: Seat[];
  onSeatPress: (seat: Seat) => void;
}

export const SeatGrid: React.FC<SeatGridProps> = ({ seats, onSeatPress }) => {
  const { width } = useWindowDimensions();

  // Responsive column count: 3 columns for phones (<600px), 4 for small tablets, 6 for large tablets/desktop
  let numColumns = 3;
  if (width >= 900) {
    numColumns = 6;
  } else if (width >= 600) {
    numColumns = 4;
  }

  // Chunk seats into rows
  const rows: Seat[][] = [];
  for (let i = 0; i < seats.length; i += numColumns) {
    rows.push(seats.slice(i, i + numColumns));
  }

  return (
    <View style={styles.container}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map(seat => (
            <SeatCard key={seat.id} seat={seat} onPress={onSeatPress} />
          ))}
          {/* Pad the last row if not full to maintain equal flex sizing */}
          {row.length < numColumns &&
            Array.from({ length: numColumns - row.length }).map((_, padIdx) => (
              <View key={`pad-${padIdx}`} style={styles.padCell} />
            ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 11,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  padCell: {
    flex: 1,
    margin: 5,
  },
});
