import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { makeStyles, useTheme } from '../../design/styles';

const useStyles = makeStyles((t) => ({
  box: { borderWidth: t.border.hairline, borderColor: t.colors.border, borderRadius: t.radius.control, overflow: 'hidden' },
  head: { minHeight: t.size.touch, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.spacing.md, paddingHorizontal: t.spacing.md },
  label: { ...t.typography.label, color: t.colors.textMuted },
  value: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
  valueText: { ...t.typography.button, color: t.colors.text },
  option: { minHeight: t.size.touch, justifyContent: 'center', paddingHorizontal: t.spacing.md, borderTopWidth: t.border.hairline, borderTopColor: t.colors.border },
  optionSelected: { backgroundColor: t.colors.raised },
  optionText: { ...t.typography.button, color: t.colors.textMuted },
  optionTextSelected: { color: t.colors.text },
  rail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: t.size.line, backgroundColor: t.colors.accent },
  pressed: { opacity: t.opacity.pressed },
}));

/**
 * A setting that shows only its current value: "PIT STOPS   2 ⌄". Tap it and the other choices open under it; tap one
 * and it closes again. A quieter replacement for a row of segments when there are only a few choices.
 */
export function Dropdown<T extends string>({
  label,
  options,
  value,
  onChange,
  labelFor,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  labelFor?: (value: T) => string;
}) {
  const styles = useStyles();
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const text = (option: T) => (labelFor ? labelFor(option) : option);

  return (
    <View style={styles.box}>
      <Pressable
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${text(value)}`}
        accessibilityHint={open ? 'Closes the choices' : 'Opens the choices'}
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.label}>{label}</Text>
        <View style={styles.value}>
          <Text style={styles.valueText}>{text(value)}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={t.size.chevron} color={t.colors.textSecondary} />
        </View>
      </Pressable>
      {open &&
        options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
              onPress={() => {
                setOpen(false);
                if (!selected) onChange(option);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={text(option)}
            >
              {selected && <View style={styles.rail} />}
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{text(option)}</Text>
            </Pressable>
          );
        })}
    </View>
  );
}
