import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Flag } from '../components/Flag';
import { TireStrategyBar } from '../components/TireStrategyBar';
import { BracketFrame, Button, SectionLabel, StatBlock } from '../components/ui';
import { TRACKS } from '../data/tracks';
import { makeStyles, useTheme } from '../design/styles';
import { recentDays } from '../logic/history';
import type { DayActivity } from '../logic/history';
import { formatDurationWords } from '../logic/sessionOptions';
import { formatDistance } from '../logic/settings';
import { dayKey, displayedStreak } from '../logic/streak';
import type { PlayerProfile, Session } from '../models/types';
import { DEFAULT_PROFILE, getProfile } from '../storage/profile';
import { getSessions } from '../storage/sessions';
import { useSettings } from '../ui/useSettings';

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const STRIP_DAYS = 7;

export default function HistoryScreen() {
  const styles = useStyles();
  const [profile, setProfile] = useState<PlayerProfile>(DEFAULT_PROFILE);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([getProfile(), getSessions()]).then(([p, s]) => {
        if (cancelled) return;
        setProfile(p);
        setSessions(s);
        setLoaded(true);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (!loaded) return <View style={styles.safe} />;

  // no races yet: a proper empty state instead of empty charts
  if (sessions.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No races yet</Text>
        <Text style={styles.emptyText}>Finish your first race and it will show up here, with your streak and your week.</Text>
        <View style={styles.emptyButton}>
          <Button label="Start Race" onPress={() => router.push('/create-session')} />
        </View>
      </View>
    );
  }

  const today = new Date();
  const streak = displayedStreak(profile, dayKey(today));
  const days = recentDays(sessions, today, STRIP_DAYS);

  const header = (
    <View style={styles.header}>
      <BracketFrame style={styles.streaks}>
        <View style={styles.streakCell}>
          <StatBlock label="Current streak" value={streak} unit={streak === 1 ? 'day' : 'days'} />
        </View>
        <View style={[styles.streakCell, styles.divided]}>
          <StatBlock label="Longest streak" value={Math.max(profile.longestStreak, streak)} unit="days" />
        </View>
      </BracketFrame>
      <View style={styles.week}>
        <SectionLabel>Last 7 days</SectionLabel>
        <WeekStrip days={days} />
      </View>
      <SectionLabel trailing={String(sessions.length)}>Races</SectionLabel>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => <SessionRow session={item} last={index === sessions.length - 1} />}
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

function WeekStrip({ days }: { days: DayActivity[] }) {
  const styles = useStyles();
  const { size } = useTheme();
  const maxSeconds = Math.max(...days.map((d) => d.focusedSeconds), 1);
  return (
    <View style={styles.strip}>
      {days.map((d, i) => {
        const height = d.focusedSeconds > 0 ? Math.max(size.progress, (d.focusedSeconds / maxSeconds) * size.weekBar) : size.progress / 2;
        const isToday = i === days.length - 1;
        return (
          <View key={d.day} style={styles.stripDay} accessible accessibilityLabel={`${d.focusedSeconds > 0 ? `${Math.round(d.focusedSeconds / 60)} minutes` : 'No races'}${isToday ? ', today' : ''}`}>
            <Text style={styles.stripMinutes}>{d.focusedSeconds > 0 ? `${Math.round(d.focusedSeconds / 60)}m` : ''}</Text>
            <View style={[styles.stripBar, { height }, d.focusedSeconds > 0 && styles.stripBarActive]} />
            <Text style={[styles.stripLetter, isToday && styles.stripToday]}>{WEEKDAY_LETTERS[d.weekday]}</Text>
          </View>
        );
      })}
    </View>
  );
}

function SessionRow({ session, last }: { session: Session; last: boolean }) {
  const styles = useStyles();
  const { size } = useTheme();
  const when = new Date(session.endedAt);
  const dateText = when.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeText = when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const track = TRACKS[session.trackId];
  const { distanceUnit } = useSettings();
  const distance = formatDistance(session.distanceKm, distanceUnit, 1);
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.rowMain}>
        <View style={styles.rowTitleLine}>
          {track && <Flag code={track.countryCode} width={size.flag - 6} />}
          <Text style={styles.rowTitle}>{track?.name ?? 'Race'}</Text>
        </View>
        <Text style={styles.muted}>
          {dateText} · {timeText}
        </Text>
        <Text style={styles.muted}>
          {session.completedLaps}/{session.plannedLaps} laps · {formatDurationWords(session.focusedSeconds)} · {distance.value} {distance.unit}
        </Text>
        {session.strategy && session.strategy.stints.length > 1 && <TireStrategyBar stints={session.strategy.stints} size="small" completedLaps={session.completedLaps} />}
      </View>
      <View style={styles.rowSide}>
        <Text style={styles.rowXp}>+{session.xpEarned} XP</Text>
        {!session.finished && <Text style={styles.early}>{session.crashed ? 'DNF · Crashed' : 'Ended early'}</Text>}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  safe: { flex: 1 },
  content: { padding: t.spacing.screen, paddingBottom: t.spacing.xl },
  header: { gap: t.spacing.lg, marginBottom: t.spacing.sm },
  muted: { ...t.typography.caption, color: t.colors.textMuted },
  streaks: { flexDirection: 'row', paddingVertical: t.spacing.md },
  streakCell: { flex: 1, paddingHorizontal: t.spacing.md },
  divided: { borderLeftWidth: t.border.hairline, borderLeftColor: t.glass.divider },
  week: { gap: t.spacing.md },
  strip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  stripDay: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: t.spacing.xs, height: t.size.weekBar + t.spacing.xl + t.spacing.sm },
  stripMinutes: { ...t.typography.microMono, height: t.spacing.md, color: t.colors.textMuted },
  stripBar: { width: t.spacing.sm + 2, backgroundColor: t.colors.border },
  stripBarActive: { backgroundColor: t.colors.accent },
  stripLetter: { ...t.typography.metaLabel, color: t.colors.textMuted },
  stripToday: { color: t.colors.text },
  // the races are a plain list: a hairline under each row, no boxes
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: t.spacing.md, paddingVertical: t.spacing.md, borderBottomWidth: t.border.hairline, borderBottomColor: t.colors.border },
  rowLast: { borderBottomWidth: 0 },
  rowMain: { flex: 1, gap: t.spacing.xxs },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  rowSide: { alignItems: 'flex-end', gap: t.spacing.xxs },
  rowTitle: { ...t.typography.body, fontFamily: t.typography.heading.fontFamily, color: t.colors.text },
  rowXp: { ...t.typography.statSmall, color: t.colors.text },
  early: { ...t.typography.caption, color: t.colors.textMuted },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.sm, padding: t.spacing.xl },
  emptyTitle: { ...t.typography.title, color: t.colors.text, textAlign: 'center' },
  emptyText: { ...t.typography.body, color: t.colors.textMuted, textAlign: 'center' },
  emptyButton: { alignSelf: 'stretch', marginTop: t.spacing.md },
}));
