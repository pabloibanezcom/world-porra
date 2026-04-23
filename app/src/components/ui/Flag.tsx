import React from 'react';
import { Image, ImageSourcePropType, Text, View } from 'react-native';

const FLAG_SOURCES: Record<string, ImageSourcePropType> = {
  ALG: require('../../../assets/flags/ALG.png'),
  ARG: require('../../../assets/flags/ARG.png'),
  AUS: require('../../../assets/flags/AUS.png'),
  AUT: require('../../../assets/flags/AUT.png'),
  BEL: require('../../../assets/flags/BEL.png'),
  BIH: require('../../../assets/flags/BIH.png'),
  BRA: require('../../../assets/flags/BRA.png'),
  CAN: require('../../../assets/flags/CAN.png'),
  CIV: require('../../../assets/flags/CIV.png'),
  COD: require('../../../assets/flags/COD.png'),
  COL: require('../../../assets/flags/COL.png'),
  CPV: require('../../../assets/flags/CPV.png'),
  CRO: require('../../../assets/flags/CRO.png'),
  CUR: require('../../../assets/flags/CUW.png'),
  CZE: require('../../../assets/flags/CZE.png'),
  ECU: require('../../../assets/flags/ECU.png'),
  EGY: require('../../../assets/flags/EGY.png'),
  ENG: require('../../../assets/flags/ENG.png'),
  ESP: require('../../../assets/flags/ESP.png'),
  FRA: require('../../../assets/flags/FRA.png'),
  GER: require('../../../assets/flags/GER.png'),
  GHA: require('../../../assets/flags/GHA.png'),
  HAI: require('../../../assets/flags/HAI.png'),
  IRN: require('../../../assets/flags/IRN.png'),
  IRQ: require('../../../assets/flags/IRQ.png'),
  JOR: require('../../../assets/flags/JOR.png'),
  JPN: require('../../../assets/flags/JPN.png'),
  KOR: require('../../../assets/flags/KOR.png'),
  KSA: require('../../../assets/flags/KSA.png'),
  MAR: require('../../../assets/flags/MAR.png'),
  MEX: require('../../../assets/flags/MEX.png'),
  NED: require('../../../assets/flags/NED.png'),
  NOR: require('../../../assets/flags/NOR.png'),
  NZL: require('../../../assets/flags/NZL.png'),
  PAN: require('../../../assets/flags/PAN.png'),
  PAR: require('../../../assets/flags/PAR.png'),
  POR: require('../../../assets/flags/POR.png'),
  QAT: require('../../../assets/flags/QAT.png'),
  RSA: require('../../../assets/flags/RSA.png'),
  SCO: require('../../../assets/flags/SCO.png'),
  SEN: require('../../../assets/flags/SEN.png'),
  SUI: require('../../../assets/flags/SUI.png'),
  SWE: require('../../../assets/flags/SWE.png'),
  TBD: require('../../../assets/flags/TBD.png'),
  TUN: require('../../../assets/flags/TUN.png'),
  TUR: require('../../../assets/flags/TUR.png'),
  URU: require('../../../assets/flags/URU.png'),
  USA: require('../../../assets/flags/USA.png'),
  UZB: require('../../../assets/flags/UZB.png'),
};

interface FlagProps {
  code: string;
  size?: number;
}

export default function Flag({ code, size = 28 }: FlagProps) {
  const normalizedCode = code.toUpperCase();
  const source = FLAG_SOURCES[normalizedCode];

  if (!source) {
    return (
      <View
        style={{
          width: size,
          height: size * 0.67,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 4,
          backgroundColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <Text style={{ fontSize: size * 0.6 }}>🏳️</Text>
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={{ width: size, height: size * 0.67, resizeMode: 'contain' }}
    />
  );
}
