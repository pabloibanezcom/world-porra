export type PlayerPosition = 'FW' | 'MF' | 'DF' | 'GK';

export interface TeamPlayerSeed {
  name: string;
  pos: PlayerPosition;
  age: number;
}

export const TEAM_PLAYERS: Record<string, TeamPlayerSeed[]> = {
  ALG: [
    { name: 'Riyad Mahrez', pos: 'FW', age: 35 },
    { name: 'Ismael Bennacer', pos: 'MF', age: 28 },
    { name: 'Rayan Ait-Nouri', pos: 'DF', age: 25 },
  ],
  ARG: [
    { name: 'Lionel Messi', pos: 'FW', age: 38 },
    { name: 'Lautaro Martinez', pos: 'FW', age: 28 },
    { name: 'Julian Alvarez', pos: 'FW', age: 26 },
    { name: 'Alejandro Garnacho', pos: 'FW', age: 21 },
  ],
  AUS: [
    { name: 'Mathew Ryan', pos: 'GK', age: 34 },
    { name: 'Jackson Irvine', pos: 'MF', age: 33 },
    { name: 'Nestory Irankunda', pos: 'FW', age: 20 },
  ],
  AUT: [
    { name: 'David Alaba', pos: 'DF', age: 33 },
    { name: 'Marcel Sabitzer', pos: 'MF', age: 32 },
    { name: 'Christoph Baumgartner', pos: 'MF', age: 26 },
  ],
  BEL: [
    { name: 'Kevin De Bruyne', pos: 'MF', age: 34 },
    { name: 'Romelu Lukaku', pos: 'FW', age: 33 },
    { name: 'Jeremy Doku', pos: 'FW', age: 24 },
  ],
  BIH: [
    { name: 'Edin Dzeko', pos: 'FW', age: 40 },
    { name: 'Miralem Pjanic', pos: 'MF', age: 36 },
    { name: 'Amar Dedic', pos: 'DF', age: 23 },
  ],
  BRA: [
    { name: 'Vinicius Jr.', pos: 'FW', age: 25 },
    { name: 'Rodrygo', pos: 'FW', age: 25 },
    { name: 'Endrick', pos: 'FW', age: 19 },
    { name: 'Alisson', pos: 'GK', age: 33 },
  ],
  CAN: [
    { name: 'Alphonso Davies', pos: 'DF', age: 25 },
    { name: 'Jonathan David', pos: 'FW', age: 26 },
    { name: 'Tajon Buchanan', pos: 'MF', age: 27 },
  ],
  CIV: [
    { name: 'Sebastien Haller', pos: 'FW', age: 31 },
    { name: 'Franck Kessie', pos: 'MF', age: 29 },
    { name: 'Ousmane Diomande', pos: 'DF', age: 22 },
  ],
  COD: [
    { name: 'Yoane Wissa', pos: 'FW', age: 29 },
    { name: 'Chancel Mbemba', pos: 'DF', age: 31 },
    { name: 'Arthur Masuaku', pos: 'DF', age: 32 },
  ],
  COL: [
    { name: 'Luis Diaz', pos: 'FW', age: 29 },
    { name: 'James Rodriguez', pos: 'MF', age: 34 },
    { name: 'Jhon Duran', pos: 'FW', age: 22 },
  ],
  CPV: [
    { name: 'Ryan Mendes', pos: 'FW', age: 36 },
    { name: 'Logan Costa', pos: 'DF', age: 25 },
    { name: 'Kevin Pina', pos: 'MF', age: 29 },
  ],
  CRO: [
    { name: 'Luka Modric', pos: 'MF', age: 40 },
    { name: 'Josko Gvardiol', pos: 'DF', age: 24 },
    { name: 'Martin Baturina', pos: 'MF', age: 23 },
  ],
  CUR: [
    { name: 'Leandro Bacuna', pos: 'MF', age: 34 },
    { name: 'Juninho Bacuna', pos: 'MF', age: 28 },
    { name: 'Vurnon Anita', pos: 'MF', age: 37 },
  ],
  CUW: [
    { name: 'Leandro Bacuna', pos: 'MF', age: 34 },
    { name: 'Juninho Bacuna', pos: 'MF', age: 28 },
    { name: 'Vurnon Anita', pos: 'MF', age: 37 },
  ],
  CZE: [
    { name: 'Patrik Schick', pos: 'FW', age: 30 },
    { name: 'Tomas Soucek', pos: 'MF', age: 31 },
    { name: 'Adam Hlozek', pos: 'FW', age: 23 },
  ],
  ECU: [
    { name: 'Moises Caicedo', pos: 'MF', age: 24 },
    { name: 'Piero Hincapie', pos: 'DF', age: 24 },
    { name: 'Kendry Paez', pos: 'MF', age: 19 },
  ],
  EGY: [
    { name: 'Mohamed Salah', pos: 'FW', age: 34 },
    { name: 'Omar Marmoush', pos: 'FW', age: 27 },
    { name: 'Mostafa Mohamed', pos: 'FW', age: 28 },
  ],
  ENG: [
    { name: 'Harry Kane', pos: 'FW', age: 32 },
    { name: 'Jude Bellingham', pos: 'MF', age: 22 },
    { name: 'Bukayo Saka', pos: 'FW', age: 24 },
    { name: 'Phil Foden', pos: 'MF', age: 26 },
  ],
  ESP: [
    { name: 'Rodri', pos: 'MF', age: 30 },
    { name: 'Pedri', pos: 'MF', age: 23 },
    { name: 'Lamine Yamal', pos: 'FW', age: 18 },
    { name: 'Nico Williams', pos: 'FW', age: 23 },
  ],
  FRA: [
    { name: 'Kylian Mbappe', pos: 'FW', age: 27 },
    { name: 'Antoine Griezmann', pos: 'FW', age: 35 },
    { name: 'Warren Zaire-Emery', pos: 'MF', age: 20 },
    { name: 'Mike Maignan', pos: 'GK', age: 30 },
  ],
  GER: [
    { name: 'Jamal Musiala', pos: 'MF', age: 23 },
    { name: 'Florian Wirtz', pos: 'MF', age: 23 },
    { name: 'Kai Havertz', pos: 'FW', age: 27 },
    { name: 'Joshua Kimmich', pos: 'MF', age: 31 },
  ],
  GHA: [
    { name: 'Mohammed Kudus', pos: 'MF', age: 25 },
    { name: 'Thomas Partey', pos: 'MF', age: 33 },
    { name: 'Inaki Williams', pos: 'FW', age: 32 },
  ],
  HAI: [
    { name: 'Duckens Nazon', pos: 'FW', age: 32 },
    { name: 'Frantzdy Pierrot', pos: 'FW', age: 31 },
    { name: 'Danley Jean Jacques', pos: 'MF', age: 26 },
  ],
  IRN: [
    { name: 'Mehdi Taremi', pos: 'FW', age: 33 },
    { name: 'Sardar Azmoun', pos: 'FW', age: 31 },
    { name: 'Alireza Jahanbakhsh', pos: 'FW', age: 32 },
  ],
  IRQ: [
    { name: 'Aymen Hussein', pos: 'FW', age: 30 },
    { name: 'Ali Jasim', pos: 'FW', age: 22 },
    { name: 'Zidane Iqbal', pos: 'MF', age: 23 },
  ],
  JOR: [
    { name: 'Mousa Al-Taamari', pos: 'FW', age: 29 },
    { name: 'Yazan Al-Naimat', pos: 'FW', age: 27 },
    { name: 'Nizar Al-Rashdan', pos: 'MF', age: 27 },
  ],
  JPN: [
    { name: 'Takefusa Kubo', pos: 'MF', age: 25 },
    { name: 'Kaoru Mitoma', pos: 'FW', age: 29 },
    { name: 'Wataru Endo', pos: 'MF', age: 33 },
  ],
  KOR: [
    { name: 'Son Heung-min', pos: 'FW', age: 33 },
    { name: 'Kim Min-jae', pos: 'DF', age: 29 },
    { name: 'Lee Kang-in', pos: 'MF', age: 25 },
  ],
  KSA: [
    { name: 'Salem Al-Dawsari', pos: 'FW', age: 34 },
    { name: 'Firas Al-Buraikan', pos: 'FW', age: 26 },
    { name: 'Mohammed Kanno', pos: 'MF', age: 31 },
  ],
  MAR: [
    { name: 'Achraf Hakimi', pos: 'DF', age: 27 },
    { name: 'Sofyan Amrabat', pos: 'MF', age: 29 },
    { name: 'Eliesse Ben Seghir', pos: 'FW', age: 21 },
  ],
  MEX: [
    { name: 'Santiago Gimenez', pos: 'FW', age: 25 },
    { name: 'Edson Alvarez', pos: 'MF', age: 28 },
    { name: 'Hirving Lozano', pos: 'FW', age: 30 },
  ],
  NED: [
    { name: 'Virgil van Dijk', pos: 'DF', age: 34 },
    { name: 'Cody Gakpo', pos: 'FW', age: 27 },
    { name: 'Xavi Simons', pos: 'MF', age: 23 },
  ],
  NOR: [
    { name: 'Erling Haaland', pos: 'FW', age: 25 },
    { name: 'Martin Odegaard', pos: 'MF', age: 27 },
    { name: 'Antonio Nusa', pos: 'FW', age: 21 },
  ],
  NZL: [
    { name: 'Chris Wood', pos: 'FW', age: 34 },
    { name: 'Liberato Cacace', pos: 'DF', age: 25 },
    { name: 'Marko Stamenic', pos: 'MF', age: 24 },
  ],
  PAN: [
    { name: 'Adalberto Carrasquilla', pos: 'MF', age: 27 },
    { name: 'Jose Fajardo', pos: 'FW', age: 32 },
    { name: 'Michael Amir Murillo', pos: 'DF', age: 30 },
  ],
  PAR: [
    { name: 'Miguel Almiron', pos: 'MF', age: 32 },
    { name: 'Julio Enciso', pos: 'FW', age: 22 },
    { name: 'Diego Gomez', pos: 'MF', age: 23 },
  ],
  POR: [
    { name: 'Cristiano Ronaldo', pos: 'FW', age: 41 },
    { name: 'Bruno Fernandes', pos: 'MF', age: 31 },
    { name: 'Rafael Leao', pos: 'FW', age: 27 },
  ],
  QAT: [
    { name: 'Akram Afif', pos: 'FW', age: 29 },
    { name: 'Almoez Ali', pos: 'FW', age: 29 },
    { name: 'Hassan Al-Haydos', pos: 'MF', age: 35 },
  ],
  RSA: [
    { name: 'Percy Tau', pos: 'FW', age: 32 },
    { name: 'Teboho Mokoena', pos: 'MF', age: 29 },
    { name: 'Ronwen Williams', pos: 'GK', age: 34 },
  ],
  SCO: [
    { name: 'Scott McTominay', pos: 'MF', age: 29 },
    { name: 'Andy Robertson', pos: 'DF', age: 32 },
    { name: 'Billy Gilmour', pos: 'MF', age: 25 },
  ],
  SEN: [
    { name: 'Sadio Mane', pos: 'FW', age: 34 },
    { name: 'Nicolas Jackson', pos: 'FW', age: 25 },
    { name: 'Pape Matar Sarr', pos: 'MF', age: 23 },
  ],
  SER: [
    { name: 'Dusan Vlahovic', pos: 'FW', age: 26 },
    { name: 'Aleksandar Mitrovic', pos: 'FW', age: 31 },
    { name: 'Sergej Milinkovic-Savic', pos: 'MF', age: 31 },
  ],
  SUI: [
    { name: 'Granit Xhaka', pos: 'MF', age: 33 },
    { name: 'Manuel Akanji', pos: 'DF', age: 30 },
    { name: 'Breel Embolo', pos: 'FW', age: 29 },
  ],
  SWE: [
    { name: 'Alexander Isak', pos: 'FW', age: 26 },
    { name: 'Viktor Gyokeres', pos: 'FW', age: 28 },
    { name: 'Lucas Bergvall', pos: 'MF', age: 20 },
  ],
  TUN: [
    { name: 'Ellyes Skhiri', pos: 'MF', age: 31 },
    { name: 'Hannibal Mejbri', pos: 'MF', age: 23 },
    { name: 'Seifeddine Jaziri', pos: 'FW', age: 33 },
  ],
  TUR: [
    { name: 'Hakan Calhanoglu', pos: 'MF', age: 32 },
    { name: 'Arda Guler', pos: 'MF', age: 21 },
    { name: 'Kenan Yildiz', pos: 'FW', age: 21 },
  ],
  URU: [
    { name: 'Darwin Nunez', pos: 'FW', age: 27 },
    { name: 'Federico Valverde', pos: 'MF', age: 27 },
    { name: 'Ronald Araujo', pos: 'DF', age: 27 },
  ],
  USA: [
    { name: 'Christian Pulisic', pos: 'FW', age: 27 },
    { name: 'Weston McKennie', pos: 'MF', age: 27 },
    { name: 'Gio Reyna', pos: 'MF', age: 23 },
  ],
  UZB: [
    { name: 'Eldor Shomurodov', pos: 'FW', age: 31 },
    { name: 'Abbosbek Fayzullaev', pos: 'MF', age: 22 },
    { name: 'Abdukodir Khusanov', pos: 'DF', age: 22 },
  ],
};
