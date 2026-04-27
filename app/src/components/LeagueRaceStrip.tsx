import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { LeagueMember } from '../types';
import { colors, fonts } from '../theme';
import Avatar from './ui/Avatar';
import {
  avatarColor,
  isCurrentMember,
  memberAvatarUrl,
  memberId,
  memberName,
  memberPoints,
  sortMembersByPoints,
} from '../utils/league';

interface Props {
  members: LeagueMember[];
  userId?: string;
  accent: string;
  accentDim: string;
}

const AVATAR_SIZE = 28;
const CURRENT_AVATAR_SIZE = 32;

export default function LeagueRaceStrip({ members, userId, accent, accentDim }: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const sorted = sortMembersByPoints(members);
  const allPoints = sorted.map(memberPoints);
  const maxPoints = Math.max(...allPoints, 0);
  const minPoints = Math.min(...allPoints, 0);
  const range = maxPoints - minPoints || 1;

  const onLayout = (event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width);

  return (
    <View style={styles.track} onLayout={onLayout}>
      <View style={[styles.trackLine, { backgroundColor: `${accent}66` }]} />
      {trackWidth > 0 &&
        [...sorted].reverse().map((member, index) => {
          const id = memberId(member) || String(index);
          const isMe = isCurrentMember(member, userId);
          const size = isMe ? CURRENT_AVATAR_SIZE : AVATAR_SIZE;
          const points = memberPoints(member);
          const pct = (points - minPoints) / range;
          const left = Math.min(pct * (trackWidth - AVATAR_SIZE), trackWidth - size);

          return (
            <View key={id} style={[styles.avatarWrap, { left, zIndex: isMe ? 20 : index }]}>
              <View
                style={[
                  styles.avatarFrame,
                  {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderColor: isMe ? accent : colors.bg,
                    borderWidth: isMe ? 2 : 1.5,
                  },
                ]}
              >
                <Avatar
                  name={memberName(member)}
                  color={avatarColor(id)}
                  imageUrl={memberAvatarUrl(member)}
                  size={size - (isMe ? 4 : 3)}
                />
              </View>
              <View style={[styles.pointsPill, isMe && { backgroundColor: accentDim }]}>
                <Text style={[styles.points, { color: isMe ? accent : colors.dim }]}>
                  {points}
                </Text>
              </View>
            </View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: CURRENT_AVATAR_SIZE + 24,
    marginTop: 8,
    position: 'relative',
  },
  trackLine: {
    position: 'absolute',
    top: CURRENT_AVATAR_SIZE / 2,
    left: CURRENT_AVATAR_SIZE / 2,
    right: CURRENT_AVATAR_SIZE / 2,
    height: 2,
    borderRadius: 1,
  },
  avatarWrap: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
  },
  avatarFrame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsPill: {
    borderRadius: 6,
    marginTop: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  points: {
    fontFamily: fonts.bodyMedium,
    fontSize: 8,
    fontWeight: '700',
  },
});
