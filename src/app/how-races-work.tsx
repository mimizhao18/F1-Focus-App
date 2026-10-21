import { ScrollView, Text, View } from 'react-native';

import { ListRow, SectionLabel } from '../components/ui';
import { TRACKS, TRACK_LIST } from '../data/tracks';
import { makeStyles } from '../design/styles';
import { PENALTY, RULES } from '../logic/distraction';
import { formatClock } from '../logic/lapProgress';
import { xpForLevel } from '../logic/rewards';
import { formatDurationWords } from '../logic/sessionOptions';

// Every number on this page comes from the rules themselves (logic/distraction.ts, logic/rewards.ts, the track data),
// so the page stays right when a rule changes.
const EXAMPLE = TRACKS.silverstone;
const EXAMPLE_LAPS = 10;
const LEVELS_SHOWN = [2, 3, 4, 5, 10];
const FREE_TRACKS = TRACK_LIST.filter((t) => t.unlockLevel <= 1).length;
const TOP_UNLOCK_LEVEL = Math.max(...TRACK_LIST.map((t) => t.unlockLevel));

const words = formatDurationWords;

export default function HowRacesWorkScreen() {
  const styles = useStyles();
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.lead}>Each race is a focus session. Your car drives a real circuit while you stay in the app, and every minute of focus earns XP and credits.</Text>

      <View style={styles.section}>
        <SectionLabel>Laps</SectionLabel>
        <Text style={styles.body}>
          You choose a track and a number of whole laps. Every track has one lap time: its real lap record, rounded to the nearest 10 seconds. At {EXAMPLE.name} a lap takes {formatClock(EXAMPLE.lapTimeSeconds)}, so {EXAMPLE_LAPS} laps are {words(EXAMPLE.lapTimeSeconds * EXAMPLE_LAPS)} of focus.
        </Text>
        <Text style={styles.body}>The clock starts when the five start lights go out (or straight away if you turned the lights off in Settings).</Text>
      </View>

      <View style={styles.section}>
        <SectionLabel>Pausing</SectionLabel>
        <Text style={styles.body}>
          You can pause at any time, and a pause excuses a break of up to {words(RULES.pauseLimitSeconds)} away from the app. After that the race starts again by itself. To end a race early, pause it first.
        </Text>
      </View>

      <View style={styles.section}>
        <SectionLabel>Leaving the app</SectionLabel>
        <Text style={styles.body}>Time away from the race never counts as focus. When you come back, how long you were gone decides what happens:</Text>
        <View>
          <ListRow title="A quick glance" subtitle="Nothing happens." value={`< ${words(RULES.trackLimitsAfterSeconds)}`} />
          <ListRow title="Track limits" subtitle="A warning when you come back." value={`${words(RULES.trackLimitsAfterSeconds)} – ${words(RULES.yellowFlagAfterSeconds)}`} />
          <ListRow title="Yellow flag" subtitle="A stronger warning." value={`${words(RULES.yellowFlagAfterSeconds)} – ${words(RULES.crashAfterSeconds)}`} />
          <ListRow title="Crash" subtitle="The race ends with a DNF. The laps you did before leaving still count." value={`${words(RULES.crashAfterSeconds)} +`} last />
        </View>
        <Text style={styles.body}>
          {PENALTY.freeWarnings === 1 ? 'Your first warning in a race is free.' : `Your first ${PENALTY.freeWarnings} warnings in a race are free.`} Each one after that takes {PENALTY.stepPercent}% off the XP and credits for that race, up to {PENALTY.maxPercent}%.
        </Text>
      </View>

      <View style={styles.section}>
        <SectionLabel>Rewards</SectionLabel>
        <Text style={styles.body}>
          Every full minute of focus earns 1 XP and 1 credit. Ending early still pays for the time you focused. A race under a minute earns nothing and is not saved. Spend credits on liveries in the Store.
        </Text>
      </View>

      <View style={styles.section}>
        <SectionLabel>Levels</SectionLabel>
        <Text style={styles.body}>
          XP adds up to levels, and levels open new tracks: {FREE_TRACKS} are open from the start, and the last one opens at level {TOP_UNLOCK_LEVEL}.
        </Text>
        <View>
          {LEVELS_SHOWN.map((level, i) => (
            <ListRow key={level} title={`Level ${level}`} value={`${xpForLevel(level)} XP`} last={i === LEVELS_SHOWN.length - 1} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionLabel>Streak</SectionLabel>
        <Text style={styles.body}>
          Race at least once a day to build a streak. Another race the same day keeps it, a race the next day adds a day, and a missed day starts it again.
        </Text>
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  container: { padding: t.spacing.screen, gap: t.spacing.xl },
  section: { gap: t.spacing.sm },
  lead: { ...t.typography.body, color: t.colors.textSecondary },
  body: { ...t.typography.body, color: t.colors.textMuted },
}));
