// Datenformat: { park, cc, rows: [ [Name, Kategorie, Hersteller, Jahr, Höhe m, Länge m, km/h, Dauer s, Inversionen, {Extras}] ] }
// Extras: tc/sc = Schienen-/Stützenfarbe, tr = Zugfarbe, al = Suchbegriffe (Alias)
// Alle Zahlen sind gerundete Näherungswerte (ohne Gewähr) – Layouts sind stilisiert nachgebaut.
export default [
  // ===================== DEUTSCHLAND =====================
  { park: 'Europa-Park', cc: 'DE', rows: [
    ['Voltron Nevera', 'launch', 'Mack Rides', 2024, 43, 1400, 100, 160, 3, { tc: '#2a6fe0', sc: '#d8dde6', tr: '#0e1a33', al: 'Rimac Voltron' }],
    ['Silver Star', 'hyper', 'Bolliger & Mabillard', 2002, 73, 1620, 130, 240, 0, { tc: '#c4cad4', sc: '#8a93a3', tr: '#1b3a6b' }],
    ['Blue Fire Megacoaster', 'launch', 'Mack Rides', 2009, 38, 1056, 100, 150, 4, { tc: '#1f5fd0', sc: '#e6e9ee', tr: '#15335e', al: 'Blue Fire' }],
    ['Wodan – Timburcoaster', 'wood', 'Great Coasters International', 2012, 40, 1050, 100, 150, 0, { tr: '#7a1d1d', al: 'Wodan' }],
    ['Euro-Mir', 'sitdown', 'Mack Rides', 1997, 28, 810, 80, 150, 0, { tc: '#d62a2a', sc: '#d8d8d8', tr: '#f0f0f0', al: 'Euromir' }],
    ['Eurosat – CanCan Coaster', 'sitdown', 'Mack Rides', 1989, 26, 920, 70, 240, 0, { tc: '#e8e8ee', sc: '#4a5e86', tr: '#2e4b8a', al: 'Eurosat' }],
    ['Alpenexpress Enzian', 'minetrain', 'Mack Rides', 1984, 17, 700, 50, 130, 0, { tc: '#6b4a2a', sc: '#4a3320' }],
    ['Matterhorn-Blitz', 'mouse', 'Mack Rides', 1999, 12, 450, 40, 100, 0, { tc: '#c8202e', sc: '#e8e8e8' }],
    ['Pegasus', 'kids', 'Mack Rides', 2000, 9, 250, 35, 70, 0, { tc: '#e8a010', sc: '#3a3a40' }],
    ['Poseidon', 'water', 'Mack Rides', 2000, 25, 800, 60, 180, 0, { tc: '#1b6fb0', sc: '#d8d8d8' }],
  ] },
  { park: 'Phantasialand', cc: 'DE', rows: [
    ['Taron', 'launch', 'Intamin', 2016, 30, 1400, 117, 90, 0, { tc: '#d86a1a', sc: '#2a2a30', tr: '#242830', trains: 2, area: 'Klugheim' }],
    ['F.L.Y.', 'flying', 'Vekoma', 2020, 44, 1030, 85, 150, 0, { tc: '#2fa0d0', sc: '#e8e8ee', tr: '#303846', al: 'Fly Flying', trains: 2, area: 'Rookburgh' }],
    ['Black Mamba', 'inverted', 'Bolliger & Mabillard', 2006, 30, 1200, 90, 150, 5, { tc: '#111114', sc: '#1a1a1e', tr: '#252528', trains: 2, area: 'Deep in Africa' }],
    ['Colorado Adventure', 'minetrain', 'Vekoma', 1996, 21, 850, 65, 180, 0, { tc: '#8a5a2a', sc: '#5a3d22', area: 'Mexico' }],
    ['Winja\'s Fear', 'sitdown', 'Vekoma', 2002, 24, 500, 60, 80, 2, { tc: '#2c6a3a', sc: '#2a2a2a', area: 'Fantasy' }],
    ['Winja\'s Force', 'sitdown', 'Vekoma', 2002, 24, 500, 60, 80, 2, { tc: '#6a2c2c', sc: '#2a2a2a', area: 'Fantasy' }],
    ['Raik', 'family', 'Vekoma', 2012, 14, 560, 55, 100, 0, { tc: '#8a3a2a', sc: '#4a3a2a', area: 'Fantasy' }],
    ['Crazy Bats', 'family', 'k. A.', 0, 9, 380, 40, 90, 0, { tc: '#6a2c8a', sc: '#2a2a3a', area: 'Fantasy' }],
  ] },
  { park: 'Holiday Park', cc: 'DE', rows: [
    ['Expedition GeForce', 'hyper', 'Intamin', 2001, 53, 1200, 120, 100, 0, { tc: '#e8e8ee', sc: '#c82020', tr: '#c82020', al: 'GeForce' }],
    ['Sky Scream', 'launch', 'Premier Rides', 2010, 43, 450, 95, 60, 2, { tc: '#d8202a', sc: '#2a2a2a' }],
  ] },
  { park: 'Heide Park', cc: 'DE', rows: [
    ['Colossos', 'wood', 'Intamin', 2001, 48, 1500, 110, 180, 0, { tr: '#d8a82a', al: 'Kampf der Giganten' }],
    ['Flug der Dämonen', 'flying', 'Vekoma', 2007, 41, 1200, 100, 140, 5, { tc: '#6a2a8a', sc: '#2a2a2a', tr: '#3a2a4a' }],
    ['Desert Race', 'launch', 'Vekoma', 2013, 53, 1000, 100, 80, 0, { tc: '#e8b82a', sc: '#c86a1a', tr: '#c84a1a' }],
    ['Krake', 'dive', 'Bolliger & Mabillard', 2015, 40, 1000, 100, 150, 3, { tc: '#1f7a8a', sc: '#1a2a3a', tr: '#10202e' }],
    ['Big Loop', 'sitdown', 'Vekoma', 1998, 28, 500, 70, 80, 1, { tc: '#d82a2a', sc: '#2a2a2a' }],
    ['Bobbahn', 'sitdown', 'Intamin', 1989, 22, 700, 60, 110, 0, { tc: '#8a2a2a', sc: '#2a2a2a' }],
  ] },
  { park: 'Hansa-Park', cc: 'DE', rows: [
    ['Schwur des Kärnan', 'hyper', 'Gerstlauer', 2015, 73, 1200, 120, 130, 0, { tc: '#c8202e', sc: '#2a2a2a', tr: '#c8202e', al: 'Kärnan Karnan' }],
    ['Nessie', 'sitdown', 'Vekoma', 1990, 28, 700, 70, 90, 2, { tc: '#2a8a4a', sc: '#2a2a2a' }],
    ['Crazy Mine', 'minetrain', 'Gerstlauer', 2007, 15, 480, 50, 100, 0, { tc: '#8a5a2a', sc: '#4a3a2a' }],
  ], flats: [['pendulum', 'Fluch von Novgorod']] },
  { park: 'Erlebnispark Tripsdrill', cc: 'DE', rows: [
    ['Mammut', 'wood', 'Great Coasters International', 2013, 30, 1100, 90, 150, 0, { tr: '#5a3a2a' }],
    ['Karacho', 'launch', 'Gerstlauer', 2015, 28, 800, 90, 70, 0, { tc: '#d86a1a', sc: '#3a3a3a' }],
  ] },
  { park: 'Movie Park Germany', cc: 'DE', rows: [
    ['MP-Xpress', 'launch', 'Premier Rides', 2008, 30, 520, 80, 60, 1, { tc: '#d8202a', sc: '#2a2a2a' }],
  ] },
  { park: 'Legoland Deutschland', cc: 'DE', rows: [
    ['Feuerdrache', 'family', 'Vekoma', 2006, 12, 450, 45, 90, 0, { tc: '#d82a2a', sc: '#6a6a6a', al: 'Fire Dragon' }],
  ] },

  // ===================== SCHWEIZ / ÖSTERREICH =====================
  { park: 'Connyland', cc: 'CH', rows: [
    ['Cobra', 'sitdown', 'Vekoma', 1992, 25, 540, 70, 80, 1, { tc: '#d82a2a', sc: '#2a2a2a' }],
  ] },
  { park: 'Wiener Prater', cc: 'AT', rows: [
    ['Boomerang (Prater)', 'sitdown', 'Vekoma', 2008, 35, 700, 80, 90, 3, { tc: '#d86a1a', sc: '#2a2a2a', al: 'Boomerang' }],
  ] },

  // ===================== NIEDERLANDE =====================
  { park: 'Walibi Holland', cc: 'NL', rows: [
    ['Goliath', 'hyper', 'Intamin', 2011, 47, 1000, 106, 100, 0, { tc: '#c8202e', sc: '#e8e8ee', tr: '#c8202e' }],
    ['Untamed', 'hybrid', 'Rocky Mountain Construction', 2019, 31, 1000, 95, 130, 2, { tc: '#d86a1a', sc: '#8a5a2a', tr: '#3a2a1a' }],
    ['Lost Gravity', 'sitdown', 'Mack Rides', 2020, 32, 1140, 90, 150, 0, { tc: '#2a6fe0', sc: '#e8e8ee', tr: '#1a2a4a' }],
    ['Xpress: Platform 13', 'launch', 'Vekoma', 2016, 25, 700, 75, 70, 0, { tc: '#8a2a8a', sc: '#2a2a2a' }],
    ['Speed of Sound', 'sitdown', 'Vekoma', 2003, 28, 640, 80, 80, 2, { tc: '#d82a2a', sc: '#2a2a2a' }],
    ['Drako', 'family', 'Vekoma', 2014, 11, 450, 50, 80, 0, { tc: '#2a8a4a', sc: '#6a6a6a' }],
  ] },
  { park: 'Efteling', cc: 'NL', rows: [
    ['Baron 1898', 'dive', 'Gerstlauer', 2015, 37, 700, 90, 100, 0, { tc: '#3a3a42', sc: '#2a2a2a', tr: '#2a2a2a' }],
    ['Python', 'sitdown', 'Vekoma', 1981, 29, 790, 75, 100, 4, { tc: '#8a5a2a', sc: '#3a3a3a', tr: '#2a2a2a' }],
    ['Joris en de Draak', 'wood', 'Great Coasters International', 2010, 28, 800, 70, 120, 0, { tr: '#2a5a8a', al: 'Joris Draak' }],
    ['Vogel Rok', 'sitdown', 'Vekoma', 1998, 20, 600, 60, 100, 0, { tc: '#d8a82a', sc: '#3a3a3a' }],
    ['Bob', 'sitdown', 'Intamin', 1992, 17, 790, 55, 90, 0, { tc: '#8a8a9a', sc: '#2a2a2a' }],
  ] },
  { park: 'Toverland', cc: 'NL', rows: [
    ['Fēnix', 'floorless', 'Bolliger & Mabillard', 2020, 40, 1000, 100, 150, 3, { tc: '#d86a1a', sc: '#2a2a2a', tr: '#c8202e', al: 'Fenix Phoenix' }],
    ['Troy', 'wood', 'Gravity Group', 2007, 34, 1000, 90, 140, 0, { tr: '#3a2a1a' }],
    ['Dwervelwind', 'family', 'Vekoma', 2012, 14, 450, 50, 90, 0, { tc: '#8a2a8a', sc: '#6a6a6a' }],
  ] },
  { park: 'Slagharen', cc: 'NL', rows: [
    ['Gold Rush', 'minetrain', 'Mack Rides', 1998, 16, 650, 55, 120, 0, { tc: '#8a5a2a', sc: '#4a3a2a' }],
  ] },

  // ===================== BELGIEN =====================
  { park: 'Walibi Belgium', cc: 'BE', rows: [
    ['Kondaa', 'hyper', 'Intamin', 2018, 50, 1300, 110, 120, 0, { tc: '#d8a82a', sc: '#3a3a3a', tr: '#8a1a1a' }],
    ['Pulsar', 'sitdown', 'Vekoma', 2008, 33, 1000, 80, 110, 1, { tc: '#2a8ad0', sc: '#e8e8ee' }],
    ['Cobra', 'sitdown', 'Vekoma', 1999, 26, 600, 70, 80, 2, { tc: '#8a2a2a', sc: '#3a3a3a' }],
    ['Psyke Underground', 'launch', 'Vekoma', 2006, 28, 700, 80, 70, 2, { tc: '#8a2a8a', sc: '#2a2a2a' }],
    ['Calamity Mine', 'minetrain', 'Vekoma', 1996, 15, 550, 55, 120, 0, { tc: '#8a5a2a', sc: '#4a3a2a' }],
  ] },
  { park: 'Bobbejaanland', cc: 'BE', rows: [
    ['Dragonfire', 'sitdown', 'Vekoma', 2007, 21, 500, 65, 80, 3, { tc: '#d86a1a', sc: '#2a2a2a' }],
    ['Typhoon', 'sitdown', 'Vekoma', 2003, 25, 600, 70, 90, 2, { tc: '#2a6fe0', sc: '#d8d8d8' }],
  ] },
  { park: 'Plopsaland De Panne', cc: 'BE', rows: [
    ['Anubis – The Ride', 'sitdown', 'Vekoma', 2014, 30, 900, 80, 120, 2, { tc: '#d8a82a', sc: '#2a2a2a', tr: '#1a1a1a', al: 'Anubis Plopsaland' }],
    ['Heidi The Ride', 'wood', 'Great Coasters International', 2013, 30, 1100, 90, 140, 0, { tr: '#c8202e', al: 'Heidi' }],
  ] },
  { park: 'Bellewaerde', cc: 'BE', rows: [
    ['Boomerang (Bellewaerde)', 'sitdown', 'Vekoma', 1989, 31, 700, 75, 90, 3, { tc: '#d86a1a', sc: '#2a2a2a', al: 'Boomerang' }],
  ] },
];
